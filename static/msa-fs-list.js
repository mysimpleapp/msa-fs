import { Q, ajax, importHtml } from '/msa/msa.js'

// style

importHtml(`<style>
	msa-fs-list {
		padding: 1em;
	}
	msa-fs-list table.list td {
		padding: 0;
	}
	msa-fs-list table.list a {
		color: inherit;
		text-decoration: inherit;
		display: block;
		padding: 0.5em 1em;
	}
</style>`)

// content

const content = `
	<h1 style="text-align:center">File systems</h1>
	<div><table class="list" style="width:100%"></table></div>`

// element

export default class HTMLMsaFsListElement extends HTMLElement {

	constructor() {
		super()
		this.Q = Q
	}

	connectedCallback() {
		this.initContent()
		if(this.fsList === undefined) this.getFsList()
		else this.sync()
	}

	getBaseUrl() {
		return this.getAttribute("base-url") || "/fs"
	}

	initContent(){
		const iContent = this.textContent
		this.innerHTML = content
		if(iContent !== '') this.fsList = JSON.parse(iContent)
	}

	getFsList(){
		ajax("GET", this.getBaseUrl() + "/_list", list => {
			this.fsList = list
			this.sync()
		})
	}

	sync() {
		const tab = this.Q("table.list")
		tab.innerHTML = ""
		for(let fs of this.fsList) {
			const row = tab.insertRow()
			const cell = row.insertCell()
			cell.classList.add("clickable")
			const link = document.createElement("a")
			cell.appendChild(link)
			link.href = link.textContent = fs.route
		}
	}
}

customElements.define("msa-fs-list", HTMLMsaFsListElement)
