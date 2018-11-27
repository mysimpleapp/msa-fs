import { ajax, importHtml, parseUrlArgs } from '/msa/msa.js'
import { join } from './msa-fs.js'

importHtml(`<style>
	msa-fs-cascade {
		display: block;
		padding: 3px 0 3px 0;
		margin: 0;
	}
	msa-fs-cascade .file {
		cursor: pointer;
		padding-left: 3px;
	}
	msa-fs-cascade .file:hover {
		background-color: #EEF;
	}
	msa-fs-cascade .file.selected {
		background-color: #DDF;
	}
	msa-fs-cascade .file svg {
		width: 16px;
		height: 16px;
		padding: 0 3px 0 3px;
	}
</style>`)

// element

export default class HTMLMsaFsCascadeElement extends HTMLElement {}
const MsaFsCascadePt = HTMLMsaFsCascadeElement.prototype

MsaFsCascadePt.connectedCallback = function(){
	if(this.getRequestServer()) this.listFiles()
}

// attributes

MsaFsCascadePt.getRootPath = function() {
	return this.getAttribute("root-path") || ""
}
MsaFsCascadePt.getPath = function() {
	var path = this.getAttribute("path") || "/"
	return join(this.getRootPath(), path)
}
MsaFsCascadePt.getRequestServer = function() {
	return this.getAttribute("request-server") !== "false"
}
MsaFsCascadePt.getBaseUrl = function() {
	return this.getAttribute("base-url") || "/fs"
}

// add subPath to current path
MsaFsCascadePt.addPath = function(subPath) {
	if(this.getRequestServer()) {
		this.listFiles()
		var path = this.getAttribute("path")
		this.setAttribute("path", join(path, subPath))
	}
}

// list files from server
MsaFsCascadePt.listFiles = function() {
	var url = join(this.getBaseUrl(), 'list', path)
	ajax('GET', url, files => {
		cascade.showFiles(files)
	})
}

// show files in element
MsaFsCascadePt.showFiles = function(files) {
	this.innerHTML = ""
	var cascade = this
	files.forEach(function(file) {
		var type = file.type, name = file.name
		var fileDom = document.createElement("div")
		fileDom.classList.add("file")
		fileDom.innerHTML = "<svg><use xlink:href='#msa-fs-"+type+"'></use></svg><span>" + name + "</span>"
		fileDom.file = file
		fileDom.onclick = function(evt) {
			if(!this.classList.contains("selected")) {
				if (!evt.ctrlKey) cascade.clearSelection()
				cascade.dispatchEvent(new CustomEvent('select', {detail:{path:cascade.getPath(), file:file}}))
			}
			this.classList.toggle("selected")
		}
		fileDom.ondblclick = function() {
			cascade.dispatchEvent(new CustomEvent('dblselect', {detail:{path:cascade.getPath(), file:file}}))
			if(file.type=="dir") cascade.addPath(file.name)
		}
		cascade.appendChild(fileDom)
	})
}

MsaFsCascadePt.clearSelection = function() {
	var selecteds = this.querySelectorAll(".selected")
	for(var i=0, len=selecteds.length; i<len; ++i) {
		selecteds[i].classList.remove("selected")
	}
}

MsaFsCascadePt.getSelectedFiles = function() {
	var files = []
	var selecteds = this.querySelectorAll(".selected")
	for(var i=0, len=selecteds.length; i<len; ++i)
		files.push(selecteds[i].file)
	return files
}

customElements.define("msa-fs-cascade", HTMLMsaFsCascadeElement)
