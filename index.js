// requires

const { promisify: prm } = require('util')

const { basename, dirname, join, relative } = require('path')

const { joinUrl, formatHtml } = Msa

const fs = require('fs')
const fsCreateReadStream = fs.createReadStream,
	fsCreateWriteStream = fs.createWriteStream,
	fsStat = fs.stat,
	fsLstat = fs.lstat,
	fsReaddir = fs.readdir,
	fsMkdir = fs.mkdir,
	fsUnlink = fs.unlink,
	fsRmdir = fs.rmdir
const fsCreateReadStreamPrm = prm(fs.createReadStream),
	fsCreateWriteStreamPrm = prm(fs.createWriteStream),
	fsStatPrm = prm(fs.stat),
	fsLstatPrm = prm(fs.lstat),
	fsReaddirPrm = prm(fs.readdir),
	fsMkdirPrm = prm(fs.mkdir),
	fsUnlinkPrm = prm(fs.unlink),
	fsRmdirPrm = prm(fs.rmdir)

const Busboy = require('busboy')
const Mime = require('mime')

const { Param } = Msa.require("params")

// var msaImg = Msa.require('img')
// var msaCache = Msa.require('cache')


// MsaFsModule ////////////////////////////////

class MsaFsModule extends Msa.Module {
	constructor(key, kwargs) {
		super(key)
		this.initParamsKey(kwargs)
		this.initParams(kwargs)
		this.initApp()
	}
}
const MsaFsModulePt = MsaFsModule.prototype

// respond any readStream as a file to client
MsaFsModulePt.sendFile = async function(path, res, args) {
	// create readStream (except if provided)
	const rs = (typeof path === "string") ? fsCreateReadStream(path) : path // TODO: use MsaFsModule.createReadStream
	// content type
	let contentType = defArg(args, 'contentType')
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
MsaFsModulePt.receiveFile = function(req, onFile, next) {
	const busboy = new Busboy({ headers: req.headers })
	const fields = {}
	busboy.on('field', (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
		fields[fieldname] = val
	})
	if(onFile) busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
		onFile(file, filename, fields)
	})
	if(next) busboy.on('finish', next)
	req.pipe(busboy)
}

// Core functions //////////////////////////////////////

// stream

MsaFsModulePt.createReadStream = async function(path, next) {
	var oRs, oErr
	try {
		oRs = fsCreateReadStream(path)
	} catch(err) {
		oErr = (err.code=='ENOENT') ? 404 : err
	}
	next(oErr, oRs)
}
MsaFsModulePt.createReadStreamPt = prm(MsaFsModulePt.createReadStream)

MsaFsModulePt.createWriteStream = async function(path, next) {
	var oWs, oErr
	try {
		// create dir (if necessary)
		const dirpath = dirname(path)
		await this.mkdirpPrm(dirpath)
		oWs = fsCreateWriteStream(path)
	} catch(err) { oErr = err }
	next(oErr, oWs)
}
MsaFsModulePt.createWriteStreamPrm = prm(MsaFsModulePt.createWriteStream)


// getMetadata

MsaFsModulePt.getMetadata = async function(iPath, next){
	var oMd, oErr
	try {
		try {
			var stats = await fsStatPrm(iPath)
		} catch(err) {
			if(err.code=='ENOENT') throw 404
			else throw err
		}
		oMd = {}
		const name = basename(iPath)
		oMd.name = name
		oMd.type = stats.isDirectory() ? "dir" : "file"
		oMd.size = stats.size
		oMd.mime = Mime.lookup(name)
	} catch(err) { oErr = err }
	next(oErr, oMd)
}
MsaFsModulePt.getMetadataPrm = prm(MsaFsModulePt.getMetadata)

// list

MsaFsModulePt.list = fs.readdir
MsaFsModulePt.listPrm = prm(MsaFsModulePt.list)

// rm

MsaFsModulePt.rm = fs.unlink
MsaFsModulePt.rmPrm = prm(MsaFsModulePt.rm)

// rmdir

MsaFsModulePt.rmdir = fs.rmdir
MsaFsModulePt.rmdirPrm = prm(MsaFsModulePt.rmdir)

// rmdirp

MsaFsModulePt.rmdirp = async function(path, next=emptyFun){
	var oErr
	try {
		// check if it is file or directory
		const md = await this.getMetadataPrm(path)
		if(md === "dir") {
			// this is a dir, read content
			const subfiles = await this.listPrm(path)
			for(let sf of subfiles) {
				// remove sub-files
				await this.rmdirpPrm(join(path, sf))
				// remove directory
				await this.rmdirPrm(path)
			}
		} else {
			// remove file
			await this.rmPrm(path)
		}
	} catch(err) { oErr = err }
	next(oErr)
}
MsaFsModulePt.rmdirpPrm = prm(MsaFsModulePt.rmdirp)

// mkdir

MsaFsModulePt.mkdir = fs.mkdir
MsaFsModulePt.mkdirPrm = prm(MsaFsModulePt.mkdir)

// mkdirp

// TODO: Add "mode" in input args
MsaFsModulePt.mkdirp = async function(path, next=emptyFun) {
	var oErr
	try {
		try {
			await this.mkdirPrm(path)
		} catch(err) {
			if(err.code==='ENOENT') {
				// if parent directory does not exists, create it
				await this.mkdirpPrm(dirname(path))
				await this.mkdirpPrm(path)
			} else if(err.code==='EEXIST') {
				// if directory already exists, just continue
				// TODO: should check if it is a valid directory
			} else throw err
		}
	} catch(err) { oErr = err }
	next(oErr)
}
MsaFsModulePt.mkdirpPrm = prm(MsaFsModulePt.mkdirp)

// upload

MsaFsModulePt.upload = async function(req, path, next=emptyFun) {
	var oFilenames = [], oErr
	var first = true
	var _next = () => {
		if(!first) return
		first = false
		next(oErr, oFilenames)
	}
	try {
		await this.mkdirpPrm(path)
		this.receiveFile(req,
			async (file, filename, attrs) => {
				try {
					var name = basename(filename)
					oFilenames.push(name)
					var fullPath = join(path, name)
					var ws = await this.createWriteStreamPrm(fullPath)
					file.pipe(ws)
				} catch(err) { oErr = err }
			},
			_next
		)
	} catch(err) { oErr = err; _next() }
}
MsaFsModulePt.uploadPrm = prm(MsaFsModulePt.upload)


// getThumbnail
// TODO make async
/*
MsaFsModulePt.getThumbnail = function(path, arg1, arg2){
	if(arg2===undefined) var next=arg1||emptyFun
	else var args=arg1, next=arg2||emptyFun
	// check file type (only images and videos have tumbnails)
	var mime = Mime.lookup(path)
	var mime1 = mime.split('/')[0]
	if(mime1!=='image' && mime1!=='video')
		return next(404)
	// save thumbnails in cache
	var cacheKey = this.name+"/"+path
	msaCache.getFile("gen/thumbs", cacheKey,
		async (wstream, onWrite) => {
			if(mime1==='video') return onWrite(501) // TODO: implement video thumbnail
			var rstream = await this.createReadStreamPrm(path)
			if(mime1==='image'){
				msaImg.createThumbnail(rstream, wstream, onWrite)
			} else onWrite(500)
		},
		next
	)
}
*/
/*
var _getThumbnail_onMiss = function(path, mime1, wstream, onWrite){
	
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

// compressImg
// TODO make async
/*
var genComressMedia = function(fs){
	var params = fs.params
	var createReadStream = fs.createReadStream,
		createWriteStream = fs.createWriteStream,
		join = fs.join
MsaFsModulePt.compressMedia = function(path, arg1, arg2){
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
*/

// HTTP //////////////////////////////////////

const { PermNum, mdw: userMdw, unauthHtml } = Msa.require("user")

let i = 0
const READ = ++i,
	WRITE = ++i,
	DELETE = ++i
	NB_PERMS = ++i

class DirPerms {

	constructor(dirExprs) {
		this.dirExprs = dirExprs
		this.perm = new this.Perm()
	}

	solvePathExpr(path) {
		let expr, maxLen = 0
		const dirExprs = this.dirExprs
		for(let dir in dirExprs) {
			if(path.startsWith(dir)) {
				const len = dir.length
				if(len > maxLen) {
					maxLen = len
					expr = dirExprs[dir]
				}
			}
		}
		if(!expr) expr = this.exprAdmin
		return expr
	}

	check(path, user, val) {
		const expr = this.solvePathExpr(path)
		return this.perm.exprCheck(expr, user, val)
	}

	checkMdw(val) {
		return (req, res, next) => {
			const expr = this.solvePathExpr(req.url)
			this.perm.exprCheckMdw(expr, val)(req, res, next)
		}
	}

	checkPage(val) {
		return (req, res, next) => {
			const expr = this.solvePathExpr(req.url)
			this.perm.exprCheckPage(expr, val)(req, res, next)
		}
	}
}
DirPerms.prototype.Perm = PermNum
DirPerms.prototype.exprAdmin = { group: "admin" }

MsaFsModulePt.DirPerms = DirPerms

// serve file-system

MsaFsModulePt.initParamsKey = function(kwargs) {
	this.paramsKey = defArg(kwargs, 'paramsKey', this.key)
}

MsaFsModulePt.initParams = function(kwargs) {
	// register params
	new Param(`${this.paramsKey}.rootDir`, {
		defVal: defArg(kwargs, 'rootDir', Msa.dirname)
	})
	new Param(`${this.paramsKey}.dirPerms`, {
		defVal: defArg(kwargs, 'dirPerms', new DirPerms({})),
		format: val => JSON.stringify(val.dirExprs),
		parse: val => new this.DirPerms(JSON.parse(val))
	})
/*
	new Param(`${this.paramsKey}.thumbnailsDir`, {
		defVal: defArg(kwargs, 'thumbnailsDir', join(Msa.dirname, "msa-server/generateds/thumbnails"))
	})
*/
	// get param
	this.params = Msa.getParam(this.paramsKey)
}

MsaFsModulePt.initApp = function(kwargs) {
	const app = this.app

	// perms
	const checkPermPage = val => this.params.dirPerms.checkPage(val)

	// route: ui
	app.get('/', (req, res, next) => {
		res.redirect( joinUrl(req.originalUrl, 'ui') )
	})
	app.subApp('/ui')
		.get('*', checkPermPage(READ), (req, res, next) => {
			// build baseUrl
			const baseUrlArr = req.baseUrl.split('/')
			baseUrlArr.pop() // remove "ui" from url
			const baseUrl = joinUrl(...baseUrlArr)
			// send page
			res.sendPage({
				wel: '/fs/msa-fs-explorer.js',
				attrs: {
					'base-url': baseUrl,
					'sync-url': true
				}
			})
		})
	// route: data
	app.subApp('/data')
		.get('*', checkPermPage(READ), Msa.express.static(this.params.rootDir))
		.post('*', checkPermPage(WRITE), this.genPostDataMdw())
		.delete('*', checkPermPage(DELETE), this.genDelDataMdw())
	// route: list
	app.subApp('/list')
		.get('*', checkPermPage(READ), this.genGetListMdw())
	// route: meta
	app.subApp('/meta')
		.get('*', checkPermPage(READ), this.genGetMetaMdw())
	// route: dir
	app.subApp('/dir')
		.post('*', checkPermPage(WRITE), this.genPostDirMdw())
		.delete('*', checkPermPage(DELETE), this.genDelDirMdw())
}

// get list mdw
MsaFsModulePt.genGetListMdw = function() { return async (req, res, next) => {
	try {
		const path = join(this.params.rootDir, req.url)
		const files = await this.listPrm(path)
		const mds = await Promise.all(files.map(f => this.getMetadataPrm(join(path, f))))
		res.json(mds)
	} catch(err) { next(err) }
}}

// get meta mdw
MsaFsModulePt.genGetMetaMdw = function() { return async (req, res, next) => {
	try {
		const path = join(this.params.rootDir, req.url)
		const data = await this.getMetadataPrm(path)
		res.json(data)
	} catch(err) { next(err) }
}}

// post data mdw
MsaFsModulePt.genPostDataMdw = function() { return async (req, res, next) => {
	try {
		const path = join(this.params.rootDir, req.url)
		const contentType = req.headers['content-type']
		if(contentType.startsWith('multipart/form-data')){
			const filenames = await this.uploadPrm(req, path)
		} else if(req.body){
			const ws = await this.createWriteStreamPrm(path)
			ws.end(req.body)
		// TODO: write progression
		}
		res.sendStatus(200)
	} catch(err) { next(err) }
}}


// post dir mdw
MsaFsModulePt.genPostDirMdw = function() { return async (req, res, next) => {
	try {
		const path = join(this.params.rootDir, req.url)
		await this.mkdirpPrm(path)
		res.sendStatus(200)
	} catch(err) { next(err) }
}}

MsaFsModulePt.genDelDataMdw = function() { return async (req, res, next) => {
	try {
		const path = join(this.params.rootDir, req.url)
		await this.rmPrm(path)
		res.sendStatus(200)
	} catch(err) { next(err) }
}}

MsaFsModulePt.genDelDirMdw = function() { return async (req, res, next) => {
	try {
		const path = join(this.params.rootDir, req.url)
		await this.rmdirpPrm(path)
		res.sendStatus(200)
	} catch(err) { next(err) }
}}


// common

function emptyFun(){}

function defArg(args, key, defVal){
	let val
	if(args) val = args[key]
	if(val===undefined) val = defVal
	return val
}

function mapObj(obj, fn) {
	const res = {}
	for(let k in obj)
		res[k] = fn(obj[k])
	return res
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


// do serve files

class MsaMultiFsModule extends Msa.Module {

	constructor(key, kwargs) {
		super(key)
		this.initParamsKey(kwargs)
		this.initParams(kwargs)
		this.initFss()
		this.initApp()
	}

	initParamsKey(kwargs) {
		this.paramsKey = this.key
	}

	initParams(kwargs) {
		this.params = Msa.getParam(this.paramsKey)
	}

	initFss() {
		this.fss = {}
		if(this.params) {
			for(let route in this.params) {	
				this.fss[route] = new MsaFsModule(route, {
					paramsKey: `${this.paramsKey}.${route}`
				})
			}
		}
	}

	initApp() {
		const app = this.app

		for(let route in this.fss) {
			app.use('/'+route, this.fss[route].app)
		}

		app.get("/", userMdw, (req, res, next) => {
			const list = this.list(req.session.user)
			if(list.length === 0)
				res.sendPage(unauthHtml)
			else
				res.sendPage({
					wel: "/fs/msa-fs-list.js",
					attrs: {
						"base-url": req.baseUrl
					},
					content: JSON.stringify(list)
				})
		})

		app.get("/_list", userMdw, (req, res, next) => {
			const list = this.list(req.session.user)
			res.json(list)
		})
	}

	list(user) {
		const list = [], fss = this.fss
		for(let route in fss) {
			const fs = fss[route]
			if(fs.params.dirPerms.check('/', user))
				list.push({ route: route })
		}
		return list
	}
}

const msaFs = module.exports = new MsaMultiFsModule("fs")

msaFs.MsaFsModule = MsaFsModule
msaFs.MsaMultiFsModule = MsaMultiFsModule

