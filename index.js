var msaFs = module.exports = Msa.module("fs")

var util = require('util'),
	promisify = util.promisify

var path = require('path')
var basename = path.basename,
	dirname = path.dirname,
	join = path.join

var fs = require('fs')
var fsCreateReadStream = fs.createReadStream,
	fsCreateWriteStream = fs.createWriteStream,
	fsStat = fs.stat,
	fsLstat = fs.lstat,
	fsReaddir = fs.readdir,
	fsMkdir = fs.mkdir,
	fsUnlink = fs.unlink,
	fsRmdir = fs.rmdir

var Busboy = msaFs.busboy = require('busboy')
var Mime = require('mime')

// var msaImg = Msa.require('img')
// var msaCache = Msa.require('cache')

// MDW //////////////////////////////////////

// respond any readStream as a file to client
var respondFile = msaFs.respondFile = function(path, arg1, arg2, arg3) {
	// input args
	if(arg3) var args=arg1, res=arg2, next=arg3||emptyFun
	else var res=arg1, next=arg2||emptyFun
	// create readStream, if not provided
	var readStream = defArg(args, 'readStream')
	if(!readStream){
		fsStat(path, function(err){
			if(err && err.code=='ENOENT') return next(404)
			else if(err) return next(err)
			_respondFile(path, fsCreateReadStream(path), args, res, next)
		})
	} else _respondFile(path, readStream, args, res, next)
}
var _respondFile = function(path, readStream, args, res, next){
	var mode = defArg(args, 'mode', 'data')
	// content Type
	if(mode=='text') res.writeHead(200, { 'Content-Type': 'text/plain' })
	else if(mode=='data') res.writeHead(200, { 'Content-Type': Mime.lookup(path) })
	else return next('Unknown mode "'+mode+'"')
	// send file content
	readStream.pipe(res)
}

// receive file(s) from client
var receiveFile = msaFs.receiveFile = function(req, onFile, next) {
	var busboy = new Busboy({ headers: req.headers })
	var fields = {}
	busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
		fields[fieldname] = val
	})
	busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
		onFile && onFile(file, filename, fields)
	})
	busboy.on('finish', function() {
		next && next()
	})
	req.pipe(busboy)
}

// Core functions //////////////////////////////////////

// join
msaFs.join = join

// stream

var createReadStream = msaFs.createReadStream = function(path, next) {
	if(!next) next=emptyFun
	fsStat(path, function(err, stats){
		if(err) {
			if(err.code=='ENOENT') return next(404)
			return next(err)
		}
		next(null, fsCreateReadStream(path))
	})
}

var createWriteStream = msaFs.createWriteStream = function(path, next) {
	if(!next) next=emptyFun
	// create dir (if necessary)
	var dirpath = dirname(path)
	mkdir(dirpath, function(err) {
		// create stream
		next(err, fsCreateWriteStream(path))
	})
}

// getMetadata

var getMetadata = msaFs.getMetadata = function(path, next){
	if(!next) next=emptyFun
	manageArr(path, _getMetadata1, next, true)
}
var _getMetadata1 = function(path, next){
	fsStat(path, function(err, stats){
		if(err) {
			if(err.code=='ENOENT') return next(404)
			return next(err)
		}
		_getMetadata2(path, stats, next)
	})
}
var _getMetadata2 = function(path, stats, next){
	var data = {}
	var name = basename(path)
	data.name = name
	data.type = stats.isDirectory() ? "dir" : "file"
	data.size = stats.size
	data.mime = Mime.lookup(name)
	next(null, data)
}

// list

var list = msaFs.list = function(path, next) {
	if(!next) next=emptyFun
	fsReaddir(path, function(err, filenames){
		if(err) return next(err)
		getMetadata(joins(path, filenames), next)
	})
}

// remove

var remove = msaFs.remove = function(path, next){
	if(!next) next=emptyFun
	manageArr(path, _remove, next)
}

var _remove = function(path, next) {
	// check if it is file or directory
	fsLstat(path, function(err, stat){
		if(err) return next(err)
		_remove1(path, stat, next)
	})
}
var _remove1 = function(path, stat, next){
	if(stat.isDirectory()) {
		// this is a dir, read content
		fsReaddir(path, function(err, subfiles){
			if(err) return next(err)
			_removeDir(path, subfiles, next)
		})
	} else {
		// remove file
		fsUnlink(path, next)
	}
}
var _removeDir = function(path, subfiles, next){
	// remove sub-files
	remove(joins(path, subfiles), function(err){
		if(err) return next(err)
		// remove directory
		fsRmdir(path, next)
	})
}

// mkdir

// TODO: Add "mode" in input args
var mkdir = msaFs.mkdir = function(path, next){
	if(!next) next=emptyFun
	manageArr(path, _mkdir1, next)
}
var _mkdir1 = function(path, next){
	fsMkdir(path, function(err){
		_mkdir2(path, err, next)
	})
}
var _mkdir2 = function(path, err, next){
	if(err) {
		// if parent directory does not exists, create it
		if(err.code==='ENOENT') {
			var parentPath = dirname(path)
			_mkdir1(parentPath, function(err){
				if(err) return next(err)
				// retry make dir
				_mkdir1(path, next)
			})
			return
		// if directory already exists, just continue
		// TODO: should check if it is a valid directory
		} else if(err.code==='EEXIST') return next()
		else return next(err)
	}
	next()
}

// extend functions

msaFs.extendFs = function(fs, fsName){
	fs.name = fsName
	fs.params = {
		maxImgSize:800
	}
	genUpload(fs)
//	genGetThumbnail(fs)
}

// upload

var genUpload = function(fs){
	var mkdir = fs.mkdir,
		createWriteStream = fs.createWriteStream
	fs.upload = function(req, path, next) {
		if(!next) next=emptyFun
		mkdir(path, function(err){
			if(err) return next(err)
			_upload1(req, path, next)
		})
	}
	var _upload1 = function(req, path, next){
		var filenames = []
		receiveFile(req,
			function(file, filename, attrs){
				_upload2(path, filenames, file, filename)
			},
			function(){
				next(null, filenames)
			}
		)
	}
	var _upload2 = function(path, filenames, file, filename){
		var name = basename(filename)
		filenames.push(name)
		var fullPath = join(path, name)
		createWriteStream(fullPath, function(err, wstream){
			if(err) return next(err)
			file.pipe(wstream)
		})
	}
}

// getThumbnail

var genGetThumbnail = function(fs){
	var fsName = fs.name
	var createReadStreamPrm = promisify(fs.createReadStream),
		createWriteStreamPrm = promisify(fs.createWriteStream),
		join = fs.join
	var getCacheFilePrm = promisify(msaCache.getFile)
	var cacheType = "thumbs/"+fsName
	fs.getThumbnail = function(path, arg1, arg2){
		if(arg2===undefined) var next=arg1||emptyFun
		else var args=arg1, next=arg2||emptyFun
		// check file type (only images and videos have tumbnails)
		var mime = Mime.lookup(path)
		var mime1 = mime.split('/')[0]
		if(mime1!=='image' && mime1!=='video')
			return next(404)
		// save thumbnails in cache
		var cacheKey = fsName+"/"+path
		msaCache.getFile("gen/thumbs", cacheKey,
			async (wstream, onWrite) => {
				if(mime1==='video') return onWrite(501) // TODO: implement video thumbnail
				var rstream = await createReadStreamPrm(path)
				if(mime1==='image'){
					msaImg.createThumbnail(rstream, wstream, onWrite)
				} else onWrite(500)
			},
			next
		)
	}
	/*var _getThumbnail_onMiss = function(path, mime1, wstream, onWrite){
		
		createReadStream(path, function(err, rstream){
			if(err) onWrite(err)
			else _getThumbnail_onMiss2(path, mime1, rstream, wstream, onWrite)
		})
	}
	var _getThumbnail_onMiss2 = function(path, mime1, rstream, wstream, onWrite){
		if(mime1==='image'){
			msaImg.createThumbnail(rstream, wstream, onWrite)
		}
		else onWrite(500)
	}*/
}

// compressImg

var genComressMedia = function(fs){
	var params = fs.params
	var createReadStream = fs.createReadStream,
		createWriteStream = fs.createWriteStream,
		join = fs.join
	fs.compressMedia = function(path, arg1, arg2){
		if(arg2===undefined) var next=arg1||emptyFun
		else var args=arg1, next=arg2||emptyFun
		var size = defArg(args, 'size', params.maxImgSize)
		// check file type (only images and videos cqn be compresed)
		var mime = Mime.lookup(path)
		var mime1 = mime.split('/')[0]
		if(mime1==='image' || mime1==='video'){
			// create temp file
			createTmpFile(function(err, tmp_wstream, tmp_rstream, removeTmpFile){
				if(err) return next(err)
				_compressMedia(path, size, tmp_wStream, tmp_rstream, next, removeTmpFile)
			})
		} else next(404)
	}
	var _compressMedia = function(path, size, tmp_wStream, tmp_rstream, next, removeTmpFile){
		if(mime1==='video') return next(501) // TODO: implement video thumbnail
		createReadStream(path, function(err, rstream){
			if(err) next(err)
			else _compressMedia2(path, size, tmp_wStream, tmp_rstream, rstream, next, removeTmpFile)
		})
	}
	var _compressMedia2 = function(path, size, tmp_wStream, tmp_rstream, rstream, next, removeTmpFile){
		if(mime1==='image'){
			msaImg.compressImage(rstream, tmp_wStream, size, function(err){
				if(err) next(err)
				else _compressMedia3(path, tmp_rstream, next, removeTmpFile)
			})
		}
		else next(500)
	}
	var _compressMedia3 = function(path, tmp_rstream, next, removeTmpFile){
		createWriteStream(path, function(err, wstream){
			if(err) next(err)
			else _compressMedia4(tmp_rstream, wstream, next, removeTmpFile)
		})
	}
	var _compressMedia4 = function(tmp_rstream, wstream, next, removeTmpFile){
		wstream.on('finish', function(){
			_compressMedia5(next, removeTmpFile)
		})
		wstream.on('error', next)
		tmp_rstream.pipe(wstream)
	}
	var _compressMedia5 = function(next, removeTmpFile){
		removeTmpFile()
		next()
	}
}

msaFs.extendFs(msaFs, 'fs')

// HTTP //////////////////////////////////////

var msaUser = Msa.require("user")
var checkUserMdw = msaUser.checkUserMdw

msaFs.app.getAsPartial('/', {
	wel: '/fs/msa-fs-explorer.html',
	attrs: {
		'sync-url': true
	}
})

// serve file-system

msaFs.serveFs = function(args){
	var sfs = defArg(args, 'sfs', {})
	sfs.fs = defArg(args, 'fs', msaFs)
	sfs.thumbnailsDir = defArg(args, 'thumbnailsDir', join(Msa.dirname, "msa-server/generateds/thumbnails"))
	sfs.params = {}
	sfs.params.rootDir = defArg(args, 'rootDir', Msa.dirname)

	sfs.callbacks = {}
	sfs.on = on
	sfs.trigger = trigger

	genGetMdw(sfs)
	genPostMdw(sfs)
	genDeleteMdw(sfs)

	var subApp = args.subApp
	if(subApp){

		// if subRoute provided, build sub-subApp
		var subRoute = args.subRoute
		if(subRoute) {
			var subApp2 = Msa.express()
			subApp.use(subRoute, subApp2)
			subApp = subApp2
		}

		// routes
		var readPerm = defArg(args, 'readPerm', { group:"admin" })
		var writePerm = defArg(args, 'writePerm', { group:"admin" })
		var delPerm = defArg(args, 'delPerm', { group:"admin" })

		subApp.get('*', checkUserMdw(readPerm), sfs.getMdw)
		subApp.post('*', checkUserMdw(writePerm), sfs.postMdw)
		subApp.delete('*', checkUserMdw(delPerm), sfs.deleteMdw)
	}

	return sfs
}

var genGetMdw = function(sfs){
	var params = sfs.params
	var fs = sfs.fs,
		getMetadata = fs.getMetadata,
		list = fs.list,
		createReadStream = fs.createReadStream,
		getThumbnail = fs.getThumbnail
	sfs.getMdw = function(req, res, next){
		var path = req.params[0]
		var fullPath = join(params.rootDir, path)
		var query = req.query, paths = query.paths
		var mode = defArg(query, 'mode', 'data')
		if(paths && (mode=='metadata' || mode=='list'))
			fullPath = joins(fullPath, paths.split(','))
		getMetadata(fullPath, function(err, data){
			if(err) return next(err)
			_getMdw2(fullPath, mode, data, res, next)
		})
	}
	var _getMdw2 = function(fullPath, mode, data, res, next){
		var fileType = data.type
		if(mode=='metadata') res.json(data)
		else if(mode=='list'){
			if(fileType=='dir') list(fullPath, _replyJson(res, next))
			else next(400) // Bad Request
		} else if(mode=='data' || mode=='text'){
			if(fileType=='file'){
				createReadStream(fullPath, function(err, readStream){
					if(err) return next(err)
					respondFile(fullPath, {
						readStream: readStream,
						mode: mode
					}, res, next)
				})
			}
			// TODO: code GET for directories (return .tar.gz)
			else next(400) // Bad Request
		} else if(mode=='thumb'){
			if(fileType=='file'){
				/* getThumbnail(fullPath, function(err, readStream){
					if(err) return next(err)
					respondFile(fullPath, {
						readStream: readStream
					}, res, next)
				}) */
			} else next(400) // Bad Request
		} else next('Unknown file type "'+fileType+'".')
	}
}

var genPostMdw = function(sfs){
	var params = sfs.params,
		postCallbacks = sfs.postCallbacks
	var fs = sfs.fs,
		upload = fs.upload,
		getMetadata = fs.getMetadata,
		mkdir = fs.mkdir
	sfs.postMdw = function(req, res, next){
		var query = req.query
		var ctx = {}
		var path = ctx.path = join(params.rootDir, req.params[0])
		var type = ctx.type = defArg(query, 'type', 'file')
		if(type==='file'){
     if(req.files){
			  upload(req, path, function(err, filenames){
				  if(err) return next(err)
				  ctx.path = joins(path, filenames)
				  _postMdw2(ctx, res, next)
			  })
      } else if(req.body){
    		createWriteStream(path, function(err, wstream){
          if(err) return next(err)
          wstream.end(req.body)
          _postMdw2(ctx, res, next)
		    })
      }
		} else if(type==='dir'){
			var paths = query.paths
			if(paths) path = ctx.path = joins(ctx.path, paths.split(','))
			mkdir(path, function(err){
				if(err) return next(err)
				_postMdw2(ctx, res, next)
			})
		} else {
			next('Unknown type "'+type+'".')
		}
	}
	var _postMdw2 = function(ctx, res, next){
		sfs.trigger("finish", ctx, function(err){
			if(err) return next(err)
			_postMdw3(ctx, res, next)
		})
	}
	var _postMdw3 = function(ctx, res, next){
		getMetadata(ctx.path, _replyJson(res, next))
	}
}

var genDeleteMdw = function(sfs){
	var params = sfs.params
	var fs = sfs.fs,
		remove = fs.remove
	sfs.deleteMdw = function(req, res, next){
		var path = join(params.rootDir, req.params[0])
		var query = req.query, paths = query.paths
		if(paths) path = joins(path, paths.split(','))
		remove(path, _replyOK(res, next))
	}
}

var _replyOK = function(res, next){
	return function(err){
		if(err) return next(err)
		res.sendStatus(200)
	}
}
var _replyJson = function(res, next){
	return function(err, data){
		if(err) return next(err)
		res.json(data)
	}
}

// common

var isArr = function(obj){
	return typeof(obj)==="object" && obj.length!==undefined
}

var joins = function(rootDir, path){
	if(!isArr(path)) return join(rootDir, path)
	else return path.map(function(p) { return join(rootDir, p) })
}

var defArg = function(args, key, defVal){
	var val
	if(args) val = args[key]
	if(val===undefined) val = defVal
	return val
}

var manageArr = function(arg, next1, next2, returnRes){
	if(isArr(arg)){
		var len=arg.length, nbToDo=len
		var gerr=null
		if(returnRes) var gres=[]
		var setDone = function(i){
			return function(err, res){
				if(err) gerr=err
				if(returnRes) gres[i]=res
				if(--nbToDo==0)
					next2(gerr, gres)
			}
		}
		if(len>0){
			for(var i=0; i<len; ++i){
				next1(arg[i], setDone(i))
			}
		}
		else next2(gerr, gres)
	} else next1(arg, next2)
}

var on = function(evt, callback){
	var callbacks = this.callbacks[evt]
	if(!callbacks) callbacks = this.callbacks[evt] = []
	callbacks.push(callback)
}

var trigger = function(evt, ctx, next){
	var callbacks = this.callbacks[evt]
	if(!callbacks) return next()
	_trigger(this, callbacks, 0, callbacks.length, ctx, next)
}
var _trigger = function(_this, callbacks, i, len, ctx, next){
	if(i>=len) return next()
	var callback = callbacks[i]
	callback.call(_this, ctx, function(err){
		if(err) return next(err)
		_trigger(_this, callbacks, i+1, len, ctx, next)
	})
}

var emptyFun = function(){}

// do serve files

msaFs.serveFs({
	fs: msaFs,
	sfs: msaFs,
	subApp: msaFs.app,
	subRoute: '/api',
	rootDir: Msa.dirname,
	readPerm: { group:"admin" },
	writePerm: { group:"admin" },
	delPerm: { group:"admin" }
})
