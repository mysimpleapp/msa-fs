import { ajax, importHtml, parseUrlArgs } from "/msa/msa.js"
import { join } from "./msa-fs.js"

importHtml(`<style>
	msa-fs-dir-viewer {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		padding: 0.5em;
	}
	msa-fs-dir-viewer .file {
		display: inline-flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 0.5em;
	}
	msa-fs-dir-viewer .file .icon {
		display: flex;
		width: 5em;
		height: 5em;
	}
	msa-fs-dir-viewer .file .icon svg {
		width: 100%;
		height: 100%;
	}
	msa-fs-dir-viewer .file .icon img {
		max-width: 100%;
		max-height: 100%;
	}
	msa-fs-dir-viewer .file .name {
		position: relative;
		width: 5em;
		height: 1em;
		text-align: center;
	}
	@media all and (max-width: 480px) {
		msa-fs-dir-viewer .file .icon {
			width: 4em;
			height: 4em;
		}
		msa-fs-dir-viewer .file .name {
			width: 4em;
		}
	}
	msa-fs-dir-viewer .file .name .text {
		position: absolute;
		width: 100%;
		height: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	msa-fs-dir-viewer .file:hover .name .text {
		height: auto;
		white-space: normal;
		overflow: visible;
		word-wrap: break-word;
		background-color: #EEF;
	}
	msa-fs-dir-viewer .file:hover {
		background-color: #EEF;
	}
	msa-fs-dir-viewer .file.selected {
		background-color: #DDF;
	}
</style>`)

// element
export default class HTMLMsaFsDirViewerElement extends HTMLElement {}
const MsaFsDirViewerPt = HTMLMsaFsDirViewerElement.prototype

// init
MsaFsDirViewerPt.connectedCallback = function() {
	if(this.getRequestServer()) this.listFiles()
}

// attributes
MsaFsDirViewerPt.getRootPath = function() {
	return this.getAttribute("root-path") || ""
}
MsaFsDirViewerPt.getPath = function() {
	var path = this.getAttribute("path") || "/"
	return join(this.getRootPath(), path)
}
MsaFsDirViewerPt.getRequestServer = function() {
	return this.getAttribute("request-server") !== "false"
}
MsaFsDirViewerPt.getBaseUrl = function() {
	return this.getAttribute("base-url") || "/fs"
}
// add subPath to current path
MsaFsDirViewerPt.addPath = function(subPath) {
	if(this.getRequestServer()) {
		this.listFiles()
		var path = this.getAttribute("path")
		this.setAttribute("path", join(path, subPath))
	}
}

// list files from server
MsaFsDirViewerPt.listFiles = function() {
	var url = join(this.getBaseUrl(), 'list', path)
	ajax('GET', url, files => {
		this.showFiles(files)
	})
}

// show given files
MsaFsDirViewerPt.showFiles = function(files) {
	this.innerHTML = ""
	var viewer=this, path=this.getPath(), baseUrl=this.getBaseUrl()
	files.forEach(function(file){
		var fileDom = document.createElement("div")
		fileDom.classList.add("file")
		fileDom.innerHTML = "<div class='icon'><svg><use xlink:href='#msa-fs-"+file.type+"'></use></svg></div><div class='name'><div class='text'>" + file.name + "</div></div>"
		fileDom.file = file
		fileDom.onclick = function(evt) {
			if(!this.classList.contains("selected")) {
				if (!evt.ctrlKey) viewer.clearSelection()
				viewer.dispatchEvent(new CustomEvent('select', {detail:{path:path, file:file}}))
			}
			this.classList.toggle("selected")
		}
		fileDom.ondblclick = () => {
			viewer.dispatchEvent(new CustomEvent('dblselect', {detail:{path:path, file:file}}))
			if(file.type=="dir") viewer.addPath(file.name)
		}
		viewer.appendChild(fileDom)
		var mime = file.mime
		var mime1 = mime.split('/')[0]
		if(mime1==='image' || mime1==='video'){
			var img = document.createElement('img')
			img.src = join(baseUrl, path, file.name)+'?mode=thumb'
			img.onload = function(){
				var icon = fileDom.querySelector('.icon')
				icon.innerHTML = ''
				icon.appendChild(img)
			}
		}
	})
}

MsaFsDirViewerPt.clearSelection = function() {
	var selecteds = this.querySelectorAll(".selected")
	for(var i=0, len=selecteds.length; i<len; ++i) {
		selecteds[i].classList.remove("selected")
	}
}

MsaFsDirViewerPt.getSelectedFiles = function() {
	var files = []
	var selecteds = this.querySelectorAll(".selected")
	for(var i=0, len=selecteds.length; i<len; ++i)
		files.push(selecteds[i].file)
	return files
}

// register elem
customElements.define("msa-fs-dir-viewer", HTMLMsaFsDirViewerElement)
