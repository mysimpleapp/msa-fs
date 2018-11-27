import { Q, ajax, importHtml, importOnCall, parseUrlArgs } from "/msa/msa.js"
import { join, dirname, postFile, download } from "./msa-fs.js"
import "./msa-fs-cascade.js"
import "./msa-fs-dir-viewer.js"

// dynamic imports
const popupDeps = `
	<script type="module" src="/utils/msa-utils-popup.js"></script>`
const createConfirmPopup = importOnCall(popupDeps, "MsaUtilsPopup.createConfirmPopup")
const createInputPopup = importOnCall(popupDeps, "MsaUtilsPopup.createInputPopup")

const prismDeps = `
	<script src="/fs/prismjs/prism.js"></script>
	<link rel="stylesheet" href="/fs/prismjs/themes/prism-okaidia.css" />`
const highlightElement = importOnCall(prismDeps, "Prism.highlightElement")

// style
importHtml(`<style>
	msa-fs-explorer {
		display: flex;
		flex-direction: column;
		padding: 20px;
	}
	msa-fs-explorer .row {
		display: flex;
		flex-direction: row;
	}
	msa-fs-explorer .col {
		display: flex;
		flex-direction: column;
	}
	msa-fs-explorer .fill {
		flex: 1;
		align-self: stretch;
	}
	msa-fs-explorer .border {
		margin: 2px;
		border: 1px solid grey;
	}
	msa-fs-explorer input, msa-fs-explorer button {
		margin: 2px;
	}
	msa-fs-explorer .viewer {
		/* padding: 5px; */
		justify-content: center;
		align-items: center;
flex: 1;
overflow: auto;
	}
	msa-fs-explorer .viewer > * {
		margin: 0;
	}
	msa-fs-explorer msa-fs-cascade {
		width: 200px;
	}
	@media all and (max-width: 736px) {
		msa-fs-explorer msa-fs-cascade {
			display: none;
		}
	}
</style>`)


// content

const content = `
	<div class="col">
		<div class="row">
			<input class="path" type="text" style="flex:1" />
			<button class="go">GO</button>
			<button class="back">Back</button>
		</div>
		<div>
			<button class="upload">Upload</button>
			<button class="download">Download</button>
			<button class="remove">Remove</button>
			<button class="mkdir">Create directory</button>
			<button class="edit">Edit</button>
			<button class="save">Save</button>
		</div>
		<div class="row" style="flex:1; min-height: 0px;">
			<msa-fs-cascade class="cascade border" request-server="false"></msa-fs-cascade>
			<div class="viewer fill border row"></div>
		</div>
	</div>
`


// global input file
const fileInput = document.createElement("input")
fileInput.type = "file"
fileInput.setAttribute("multiple", true)
//fileInput.cssText = "position:absolute; top:-1000px; left:-1000px;"
fileInput.onchange = function() {
	this.holder.upload(this.files)
}
//document.body.appendChild(fileInput)


export class HTMLMsaFsExplorerElement extends HTMLElement {

	constructor(){
		super()
		this.editing = false
		this.viewerType = null
		this.fileCache = {}

		this.Q = Q
	}

	connectedCallback() {
		this.initContent()
		this.initActions()
		// request server (if needed)
		if(this.getRequestServer()) {
			let path
			if(this.getSyncUrl())
				// TODO: improve this
				path = window.location.pathname.slice(this.getBaseUrl().length+3)
			else
				path = this.getPath()
			this.goTo(path)
		}
	}

	// attrs
	getRootPath() {
		return this.getAttribute("root-path") || ""
	}
	getPath() {
		const path = this.getAttribute("path") || "/"
		return join(this.getRootPath(), path)
	}
	getRequestServer() {
		return this.getAttribute("request-server") !== "false"
	}
	getBaseUrl() {
		return this.getAttribute("base-url") || "/fs"
	}
	getSyncUrl() {
		return this.getAttribute("sync-url") === "true"
	}

	setPath(path) {
		this.Q(".path").value = path
		this.setAttribute("path", path)
		if(this.getSyncUrl())
			window.history.replaceState(null, null, join(this.getBaseUrl(), "ui", path))
	}

/*
	// REQUEST

	var onbadperm = function(explorer) {
		return function(){
			explorer.innerHTML = "<msa-user-login unauthorized></msa-user-login>"
		}
	}
*/

	// content
	initContent() {
		this.innerHTML = content
	}

	// get file metadata
	getMetadata(path, next) {
		const url = join(this.getBaseUrl(), 'meta', path)
		ajax('GET', url, next) 
	}

	// get dir content from server
	listFiles(path, next, refreshCache) {
		var fileCache = this.fileCache
		var cache = fileCache[path]
		if(cache && refreshCache!==true) next(cache)
		else {
			var explorer = this
			var url = join(explorer.getBaseUrl(), 'list', path)
			ajax('GET', url, function(files){
				fileCache[path] = files
				next(files)
			})
		}
	}

	// remove a file
	remove(names) {
		if(!names) names = this.getSelectedNames()
		var nbDeleting = names.length
		names.forEach(name => {
			var url = join(this.getBaseUrl(), 'dir', dirname(this.getPath()), name)
			ajax('DELETE', url, () => {
				if(--nbDeleting===0)
					this.goBack()
			})
		})
	}

	// create a directory
	mkdir(name) {
		if(!name) return
		const url = join(this.getBaseUrl(), 'dir', this.getPath(), name)
		ajax('POST', url, () => {
			this.refresh()
		})
	}

	// upload a file
	upload(files) {
		const url = join(this.getBaseUrl(), 'data', this.getPath())
		MsaFs.postFile(files, url, () => {
			this.refresh()
		})
	}

	// go to directory
	goTo(path) {
		// if path is not provided, use path input's one
		if(path===undefined) path = this.Q(".path").value
		this.showFile(path)
	}

	// go to parent directory
	goBack() {
		const path = this.getPath()
		this.goTo(dirname(path))
	}

	// refresh
	refresh() {
		this.showFile(this.getPath())
	}

	// show file in cascade and viewer
	showFile(path) {
		this.getMetadata(path, md => {
			this.showFileInCascade(path, md)
			this.showFileInViewer(path, md)
		})
	}

	// show dir in cascade (or parent dir, if type is file)
	showFileInCascade(path, md) {
		if(md.type!=="dir" && path!=='/') path = dirname(path)
		this.listFiles(path, files => {
			this.showDirInCascade(path, files)
		})
	}

	// show directory in cascade
	showDirInCascade(path, files) {
		const cascade = this.Q(".cascade")
		cascade.setAttribute('path', path)
		cascade.showFiles(files)
	}

	// VIEWER

	// clear viewer
	clearViewer(path, files) {
		this.Q(".viewer").innerHTML = ""
	}

	// show file in viewer (whatever its type)
	showFileInViewer(path, md) {
		this.setPath(path)
		this.clearViewer()
		if(md.type=="dir"){
			this.listFiles(path, files => {
				this.showDirInViewer(path, files)
			})
		} else if(md.type=="file"){
			var mime = md.mime
			var mime1 = mime.split('/')[0]
			if(mime1==='image'){
				this.showImageInViewer(path)
			} else if(mime1==='video'){
				this.showVideoInViewer(path, mime)
			} else {
				this.showTextInViewer(path)
			}
		}
	}

	// show dir in viewer
	showDirInViewer(path, files) {
		this.viewerType = "dir"
		this.clearViewer()
		const viewer = this.Q(".viewer")
		const dirViewer = document.createElement("msa-fs-dir-viewer")
		dirViewer.classList.add('fill')
		dirViewer.setAttribute("path", path)
		dirViewer.setAttribute("request-server", "false")
		dirViewer.addEventListener("dblselect", evt => {
			const path = evt.detail.path, file = evt.detail.file
			if(file.type==='dir')
				this.goTo(join(path, file.name))
		})
		dirViewer.showFiles(files)
		viewer.appendChild(dirViewer)
	}

	// show image in viewer
	showImageInViewer(path) {
		this.viewerType = "img"
		this.clearViewer()
		const viewer = this.Q(".viewer")
		const img = document.createElement("img")
		img.src = join(this.getBaseUrl(), 'data', path)
		viewer.appendChild(img)
	}

	// show video in viewer
	showVideoInViewer(path, type) {
		this.viewerType = "video"
		this.clearViewer()
		const viewer = this.Q(".viewer")
		const video = document.createElement("video")
		video.src = join(this.getBaseUrl(), 'data', path)
		video.setAttribute('type', type)
		video.setAttribute('controls', true)
		viewer.appendChild(video)
	}

	// show text in viewer
	showTextInViewer(path){
		this.viewerType = "text"
		this.clearViewer()
		const viewer = this.Q(".viewer")
		const url = join(this.getBaseUrl(), 'data', path)
		ajax('GET', url, { parseRes:false }, text => {
			// create pre element
			const pre = document.createElement("pre")
			pre.classList.add('fill')
			// check if this is code, and determine language
			const ext = path.split('.').pop()
			if(["js", "css", "html", "json", "xml"].indexOf(ext) !== -1) var lang = ext
			if(lang) pre.classList.add("language-" + lang)
			pre.textContent = text
			// highlight
			highlightElement(pre, true)
			viewer.appendChild(pre)
		})
	}

	// edit
	edit(){
		if(this.viewerType !== "text") return
		this.editing = true
		const  pre = this.Q(".viewer pre")
		pre.setAttribute("contenteditable", true)
		pre.onkeydown = evt => {
			if (evt.keyCode === 13) {
				document.execCommand('insertHTML', false, '\n');
				return false; 
			}
		}
	}

	// save
	save() {
		if(!this.editing) return
		const pre = this.Q(".viewer pre"),
			content = pre.textContent
		const url = join(this.getBaseUrl(), 'data', this.getPath())
		ajax('POST', url, { body:content }, () => {
			this.refresh()
		})
	}

	// get selected file names from cascade
	getSelectedNames() {
		// files from cascade
		const cascade = this.Q(".cascade")
		const files = cascade.getSelectedFiles()
		const names = files.map(file => file.name)
		// files from dir viewer (if any)
		const dirViewer = this.Q(".viewer msa-fs-dir-viewer")
		if(dirViewer){
			const dirFiles = dirViewer.getSelectedFiles()
			names = names.concat(dirFiles.map(file => file.name))
		}
		return names
	}

	// download a file
	download(names) {
		if(!names) names = this.getSelectedNames()
		if(!names) {
			names.forEach(name => {
				const href = name, path = dirname(this.getPath())
				if(path) href = join(path, name)
				href = join(holder.getBaseUrl(), 'data', href)
				download(href)
			})
		} else {
			const href = join(this.getBaseUrl(), 'data', this.getPath())
			download(href)
		}
	}

	// actions
	initActions() {
		this.Q(".path").onkeypress = evt => {
			if(evt.key == "Enter") this.goTo()
		}
		this.Q(".go").onclick = () => {
			this.goTo()
		}
		this.Q(".back").onclick = () => {
			this.goBack()
		}
		this.Q(".upload").onclick = () => {
			fileInput.holder = this
			fileInput.click()
		}
		this.Q(".download").onclick = () => {
			this.download()
		}
		this.Q(".remove").onclick = () => {
			const files = this.getSelectedNames()
			createConfirmPopup("Are you sure you want to remove these files ? " + files, () => {
				this.remove()
			})
		}
		this.Q(".mkdir").onclick = () => {
			createInputPopup("Enter the name of the directory to create", name => {
				this.mkdir(name)
			})
		}
		this.Q(".edit").onclick = () => {
			this.edit()
		}
		this.Q(".save").onclick = () => {
			this.save()
		}
		this.Q(".cascade").addEventListener("select", evt => {
			const detail = evt.detail, md = detail.file
			this.showFileInViewer(join(detail.path, md.name), md)
		})
		this.Q(".cascade").addEventListener("dblselect", evt => {
			const path = evt.detail.path, file = evt.detail.file
			if(file.type==='dir')
				this.goTo(join(path, file.name))
		})
	}
}

// register elem
customElements.define("msa-fs-explorer", HTMLMsaFsExplorerElement)
