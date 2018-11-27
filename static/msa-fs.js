import { ajax, importHtml, formatUrlArgs } from '/msa/msa.js'

// svg
importHtml({ body:
`<svg id="msa-fs-svg" style="display:none">

	<!-- file -->
	<symbol id="msa-fs-file" viewBox="0 0 32 32" fill="#55F">
		<path d="M28.681 7.159c-0.694-0.947-1.662-2.053-2.724-3.116s-2.169-2.030-3.116-2.724c-1.612-1.182-2.393-1.319-2.841-1.319h-15.5c-1.378 0-2.5 1.121-2.5 2.5v27c0 1.378 1.122 2.5 2.5 2.5h23c1.378 0 2.5-1.122 2.5-2.5v-19.5c0-0.448-0.137-1.23-1.319-2.841zM24.543 5.457c0.959 0.959 1.712 1.825 2.268 2.543h-4.811v-4.811c0.718 0.556 1.584 1.309 2.543 2.268zM28 29.5c0 0.271-0.229 0.5-0.5 0.5h-23c-0.271 0-0.5-0.229-0.5-0.5v-27c0-0.271 0.229-0.5 0.5-0.5 0 0 15.499-0 15.5 0v7c0 0.552 0.448 1 1 1h7v19.5z"></path>
	</symbol>

	<!-- dir -->
	<symbol id="msa-fs-dir" viewBox="0 0 32 32" fill="#CC0">
		<path d="M14 4l4 4h14v22h-32v-26z"></path>
	</symbol>
</svg>` }, document.body)

export function join() {
	var res = ""
	for(var i=0, len=arguments.length; i<len; ++i) {
		if(i>0) res += "/"
		res += arguments[i]
	}
	return res.replace(/\/{2,}/g, '/')
}

export function basename(path) {
	var i = path.lastIndexOf('/')
	return path.substring(i+1)
}

export function dirname(path) {
	var i = path.lastIndexOf('/')
	return path.substring(0, i)
}

export function sendFile(file, method, url, arg1, arg2) {
	if(typeof arg1==="function") var onsuccess=arg1
	else var args=arg1, onsuccess=arg2
	// create FormData
	var form = new FormData()
	// fields
	var fields = args && args.fields
	if(fields)
		for(var k in fields)
			form.set(k, fields[k])
	// files
	var files = (file.length===undefined) ? [file] : file
	for(var i=0, len=files.length; i<len; ++i)
		form.append("files[]", files[i])
	// send
	var args2 = Object.assign({}, args)
	args2.body = form
	args2.contentType = null
	ajax(method, url, args2, onsuccess)
}

export function postFile(file, url, arg1, arg2) {
	sendFile(file, "POST", url, arg1, arg2)
}

// download a file
export function download(url, args) {
	var fullUrl = url
	if(args!==undefined) fullUrl += formatUrlArgs(args)
	// build (hidden) download DOM elem
	var a = document.createElement('a')
	a.style.position = "absolute"
	a.style.top = "-1000px"
	a.style.left = "-1000px"
	a.href = fullUrl
	a.setAttribute("download", basename(fullUrl))
	// trigger download
	document.body.appendChild(a)
	a.click()
	// clean button
	a.remove()
}

// various

const getArg = function(args, name, defVal) {
	var val = args && args[name]
	return (val===undefined) ? defVal : val
}
