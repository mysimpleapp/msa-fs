var msaFs = module.exports = Msa.module("fs")

const util = require('util'),
	promisify = util.promisify

const path = require('path')
const basename = path.basename,
	dirname = path.dirname,
	join = path.join

const joinUrl = Msa.joinUrl,
	formatHtml = Msa.formatHtml

const fs = require('fs')
const fsCreateReadStream = fs.createReadStream,
	fsCreateWriteStream = fs.createWriteStream,
	fsStat = fs.stat,
	fsLstat = fs.lstat,
	fsReaddir = fs.readdir,
	fsMkdir = fs.mkdir,
	fsUnlink = fs.unlink,
	fsRmdir = fs.rmdir
const fsCreateReadStreamPrm = promisify(fs.createReadStream),
	fsCreateWriteStreamPrm = promisify(fs.createWriteStream),
	fsStatPrm = promisify(fs.stat),
	fsLstatPrm = promisify(fs.lstat),
	fsReaddirPrm = promisify(fs.readdir),
	fsMkdirPrm = promisify(fs.mkdir),
	fsUnlinkPrm = promisify(fs.unlink),
	fsRmdirPrm = promisify(fs.rmdir)


const Busboy = msaFs.busboy = require('busboy')
const Mime = require('mime')

// var msaImg = Msa.require('img')
// var msaCache = Msa.require('cache')

// MDW //////////////////////////////////////

// respond any readStream as a file to client
const sendFile = msaFs.sendFile = async function(path, res, args) {
	// create readStream (except if provided)
	var rs = (typeof path === "string") ? fsCreateReadStream(path) : path
	// content type
	var contentType = defArg(args, 'contentType')
	if(!contentType) contentType = Mime.lookup(rs.path)
	// read stream callbacks
	var first = true
	rs.on('readable', () => {
		if(!first) return
		first = false
		res.writeHead(200, { 'Content-Type': contentType })
		rs.pipe(res)
	})
	rs.on('error', err => {
		if(!first) return
		first = false
		if(err.code==='ENOENT') {
			return res.sendStatus(404)
		} else {
			console.error(err)
			return res.sendStatus(500)
		}
	})
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
msaFs.join = fs.join

// stream

var createReadStream = msaFs.createReadStream = async function(path, next) {
	var oRs, oErr
	try {
		var stats = await fsStatPrm(path)
		oRs = fsCreateReadStream(path)
	} catch(err) {
		oErr = (err.code=='ENOENT') ? 404 : err
	}
	next(oErr, oRs)
}

var createWriteStream = msaFs.createWriteStream = async function(path, next) {
	var oWs, oErr
	try {
		// create dir (if necessary)
		var dirpath = dirname(path)
		await mkdirpPrm(dirpath)
		oWs = fsCreateWriteStream(path)
	} catch(err) { oErr = err }
	next(oErr, oWs)
}


// getMetadata

var getMetadata = msaFs.getMetadata = async function(iPath, next){
	var oDatas = [], oErr
	try {
		var paths = asArr(iPath)
		for(var path of paths) {
			try {
				var stats = await fsStatPrm(path)
			} catch(err) {
				if(err.code=='ENOENT') throw 404
				else throw err
			}
			var data = {}
			var name = basename(path)
			data.name = name
			data.type = stats.isDirectory() ? "dir" : "file"
			data.size = stats.size
			data.mime = Mime.lookup(name)
			oDatas.push(data)
		}
	} catch(err) { oErr = err }
	next(oErr, isArr(iPath) ? oDatas : oDatas[0])
}
var getMetadataPrm = msaFs.getMetadataPrm = promisify(getMetadata)

// list

const list = msaFs.list = async function(iPath, next) {
	var oList = [], oErr
	try {
		var paths = asArr(iPath)
		for(var path of paths){
			var filenames = await fsReaddirPrm(path)
			var data = await getMetadataPrm(joins(path, filenames))
			oList.push(data)
		}
	} catch(err) { oErr = err }
	next(oErr, isArr(iPath) ? oList : oList[0])
}
const listPrm = promisify(list)

// rmdirp

var rmdirp = msaFs.rmdirp = async function(path, next=emptyFun){
	var oErr
	try {
		var paths = asArr(path)
		for(var path of paths){
			// check if it is file or directory
			var stat = await fsLstatPrm(path)
			if(stat.isDirectory()) {
				// this is a dir, read content
				var subfiles = await fsReaddirPrm(path)
				// remove sub-files
				await rmdirpPrm(joins(path, subfiles))
				// remove directory
				await fsRmdirPrm(path)
			} else {
				// remove file
				await fsUnlinkPrm(path)
			}
		}
	} catch(err) { oErr = err }
	next(oErr)
}
var rmdirpPrm = msaFs.rmdirpPrm = promisify(rmdirp)

// mkdirp

// TODO: Add "mode" in input args
var mkdirp = msaFs.mkdirp = async function(path, next=emptyFun) {
	var oErr
	try {
		var paths = asArr(path)
		for(var path of paths){
			try {
				await fsMkdirPrm(path)
			} catch(err) {
				if(err.code==='ENOENT') {
					// if parent directory does not exists, create it
					await mkdirpPrm(dirname(path))
					await mkdirpPrm(path)
				} else if(err.code==='EEXIST') {
					// if directory already exists, just continue
					// TODO: should check if it is a valid directory
				} else throw err
			}
		}
	} catch(err) { oErr = err }
	next(oErr)
}
var mkdirpPrm = msaFs.mkdirpPrm = promisify(mkdirp)

// TODO: remove extendFs
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
	var mkdirpPrm = promisify(fs.mkdirp),
		createWriteStreamPrm = promisify(fs.createWriteStream)
	fs.upload = async function(req, path, next=emptyFun) {
		var oFilenames = [], oErr
		var first = true
		var _next = () => {
			if(!first) return
			first = false
			next(oErr, oFilenames)
		}
		try {
			await mkdirpPrm(path)
			receiveFile(req,
				async (file, filename, attrs) => {
					try {
						var name = basename(filename)
						oFilenames.push(name)
						var fullPath = join(path, name)
						var ws = await createWriteStreamPrm(fullPath)
						file.pipe(ws)
					} catch(err) { oErr = err }
				},
				_next
			)
		} catch(err) { oErr = err; _next() }
	}
}

// getThumbnail
// TODO make async
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
// TODO make async
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

// serve file-system

msaFs.serveFs = function(args){
	var sfs = defArg(args, 'sfs', {})
	sfs.fs = defArg(args, 'fs', msaFs)
	sfs.thumbnailsDir = defArg(args, 'thumbnailsDir', join(Msa.dirname, "msa-server/generateds/thumbnails"))
	sfs.params = {}
	sfs.params.rootDir = defArg(args, 'rootDir', Msa.dirname)

//	sfs.callbacks = {}
//	sfs.on = on
//	sfs.trigger = trigger

	var app = args.app
	if(app){

		// routes
		var readPerm = defArg(args, 'readPerm', { group:"admin" })
		var writePerm = defArg(args, 'writePerm', { group:"admin" })
		var delPerm = defArg(args, 'delPerm', { group:"admin" })

		// route: ui
		app.get('/', (req, res, next) => {
			res.redirect( joinUrl(req.originalUrl, 'ui') )
		})
		app.subApp('/ui')
			.get('*', (req, res, next) => {
				// build baseUrl
				var baseUrlArr = req.baseUrl.split('/')
				baseUrlArr.pop() // remove "ui" from url
				const baseUrl = joinUrl(...baseUrlArr)
				// send page
				res.sendPage({
					wel: '/fs/msa-fs-explorer.html',
					attrs: {
						'base-url': baseUrl,
						'sync-url': true
					}
				})
			})
		// route: data
		app.subApp('/data')
			.get('*', checkUserMdw(readPerm), Msa.express.static(sfs.params.rootDir))
			.post('*', checkUserMdw(writePerm), genPostDataMdw(sfs))
			.delete('*', checkUserMdw(delPerm), genDelDataMdw(sfs))
		// route: list
		app.subApp('/list')
			.get('*', checkUserMdw(readPerm), genGetListMdw(sfs))
		// route: meta
		app.subApp('/meta')
			.get('*', checkUserMdw(readPerm), genGetMetaMdw(sfs))
		// route: dir
		app.subApp('/dir')
			.post('*', checkUserMdw(writePerm), genPostDirMdw(sfs))
			.delete('*', checkUserMdw(delPerm), genDelDirMdw(sfs))
	}

	return sfs
}

// get list mdw
const genGetListMdw = sfs => async (req, res, next) => {
	try {
		const path = join(sfs.params.rootDir, req.params[0])
		const files = await listPrm(path)
		res.json(files)
	} catch(err) { next(err) }
}

// get meta mdw
const genGetMetaMdw = sfs => async (req, res, next) => {
	try {
		const path = join(sfs.params.rootDir, req.params[0])
		const data = await getMetadataPrm(path)
		res.json(data)
	} catch(err) { next(err) }
}

// post data mdw
const genPostDataMdw = sfs => {
	const uploadPrm = promisify(sfs.fs.upload),
		createWriteStreamPrm = promisify(sfs.fs.createWriteStream)
	return async (req, res, next) => {
		try {
			const path = join(sfs.params.rootDir, req.params[0])
			const contentType = req.headers['content-type']
			if(contentType.startsWith('multipart/form-data')){
				const filenames = await uploadPrm(req, path)
//				ctx.path = joins(path, filenames)
			} else if(req.body){
				var ws = await createWriteStreamPrm(path)
				ws.end(req.body)
				// TODO: write progression
			}
			res.sendStatus(200)
		} catch(err) { next(err) }
	}
}


// post dir mdw
const genPostDirMdw = sfs => async (req, res, next) => {
	try {
		const path = join(sfs.params.rootDir, req.params[0])
		await mkdirpPrm(path)
		res.sendStatus(200)
	} catch(err) { next(err) }
}

const genDelDataMdw = sfs => async (req, res, next) => {
	try {
		const path = join(sfs.params.rootDir, req.params[0])
		await fsUnlinkPrm(path)
		res.sendStatus(200)
	} catch(err) { next(err) }
}

const genDelDirMdw = sfs => async (req, res, next) => {
	try {
		const path = join(sfs.params.rootDir, req.params[0])
		await rmdirpPrm(path)
		res.sendStatus(200)
	} catch(err) { next(err) }
}


// common

var isArr = Array.isArray

var joins = function(rootDir, path){
	if(!isArr(path)) return join(rootDir, path)
	else return path.map( p => join(rootDir, p) )
}

var defArg = function(args, key, defVal){
	var val
	if(args) val = args[key]
	if(val===undefined) val = defVal
	return val
}

var asArr = function(a){
	return isArr(a) ? a : [a]
}

/*
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
*/

var emptyFun = function(){}

// do serve files

msaFs.serveFs({
	fs: msaFs,
	sfs: msaFs,
	app: msaFs.app,
	subRoute: '/api',
	rootDir: Msa.dirname,
	readPerm: { group:"admin" },
	writePerm: { group:"admin" },
	delPerm: { group:"admin" }
})
