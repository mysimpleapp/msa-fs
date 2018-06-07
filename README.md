# msa-fs
MySimpleApp file-system component.

## CLIENT API

The following code is available by importing the corresponding web component:
```html
<!-- Example -->
<link rel="import" href="../msa-fs/msa-fs-explorer.html"></link>
```

### CustomElement: msa-fs-explorer

Panel allowing to navigate through server file system.

![Example](/doc/msa-fs-explorer.png)

```html
<!-- Simple example -->
<msa-fs-explorer></msa-fs-explorer>

<!-- Complex example -->
<msa-fs-explorer
	root-path="/root/path"
	path="/current/subpath"
	request-server="true"
	base-url="/my-fs-service"
></msa-fs-explorer>

<script>
	var explorer = document.querySelector("msa-fs-explorer")
	explorer.goTo("/another/subpath")
</script>
```

* __msa-fs-explorer__: `HTML Custom Element`
  * __root-path__: `HTML Attribute`, path of the root directory where user can navigate. The user will not be able to navigate above this root directory (default: "").
  * __path__: `HTML Attribute`, current explored path (default: "/").
  * __request-server__: `HTML Attribute`, specify if element send requests to server (default: "true").
  * __base-url__: `HTML Attribute`, web service to target (default: "/fs").
  * __goTo__: `Function(path)`, set explored path.

### CustomElement: msa-fs-cascade

Panel allowing to navigate through server file directories, in a cascade style view.

![Example](/doc/msa-fs-cascade.png)

Same API as __msa-fs-explorer__.

### CustomElement: msa-fs-dir-viewer

Panel allowing to view content of server directory.

![Example](/doc/msa-fs-dir-viewer.png)

Same API as __msa-fs-explorer__.

### Function: MsaFs.join
From: `msa-fs.html`

Join some path components together.

```javascript
// Example
var path = MsaFs.join("some", "..", "path")
// path = "some/../path"
```

* __MsaFs.join__: `Function(*pathComps)`
  * __pathComps__: `String`, path components to join together.

### Function: MsaFs.basename
From: `msa-fs.html`

Return basename of given path.

```javascript
// Example
var name = MsaFs.basename("/some/path/file.txt")
// name = "file.txt"
```

* __MsaFs.basename__: `Function(path)`
  * __*path__: `String`, path from which basename is extracted.

### Function: MsaFs.postFile
From: `msa-fs.html`

Send file to server, using POST HTTP request and FormData.

```javascript
// Example
var input = document.querySelector("input[type=file]")
input.onchange = function(event) {
	var files = input.files
	MsaFs.postFile(files, "/upload/path", function(){
		console.log("Files has been uploaded.")
	})
}
```

* __MsaFs.postFile__: `Function(file, url [, args, onsuccess])`
  * __*file__: `File Object` or `Array[File Object]`, file (or list of files) to send to server.
  * __*url__: `String`, target URL where to send file.
  * __args__: `Object`, possible properties:
    * __fields__: `Object`, additionnal fields filled in FormData.
    * Same args properties than __Msa.send__ are also available.
  * __onsuccess__: `Function`, function called where file(s) is uploaded.

### Function: MsaFs.sendFile
From: `msa-fs.html`

Send file to server, using FormData.

* __MsaFs.postFile__: `Function(file, method, url [, args, onsuccess])`
  * __*file__: `File Object` or `Array[File Object]`, file (or list of files) to send to server.
  * __*method__: `String`, HTTP method to use (examples: "GET", "POST"...).
  * __*url__: `String`, target URL where to send file.
  * __args__: Same as __MsaFs.postFile__.
  * __onsuccess__: Same as __MsaFs.postFile__.

### Function: MsaFs.download
From: `msa-fs.html`

Download file from server.

```javascript
// Example
MsaFs.download("/path/to/file")
```

* __MsaFs.download__: `Function(url, args)`
  * __*url__: `String`, target URL of file to download.
  * __args__: `Object`, additional arguments in server request.

### Route: /fs

Serve page containing msa-fs-explorer, linked to server file system.

Only avilable for admin users.

### Route: GET /fs/api

Get resource from App file-system.

```html
<html>
  <!-- Example: get file -->
  <img src="/fs/api/file/path">

  <script>
    // Example: get file metadata
    Msa.get("/fs/api/file/path",
      {query: {mode:"metadata"}},
      function(metadata){
        console.log("The file metadata:")
        console.log("type:", metadata.type)
        console.log("name:", metadata.name)
      }
    )

    // Example: list directory
    Msa.get("/fs/api/dir/path",
      {query: {mode:"list"}},
      function(childs_metadatas){
        console.log("The directory contains these files:")
        childs_metadatas.forEach( file =>
          console.log("type:", file.type)
          console.log("name:", file.name)
        )
      }
    )
  </script>
</html>
```

* __GET /fs/api/<path>__
  * __*path__: `String`, path to file/directory to get.
  * __query__: possible keys are:
    * __mode__: possible values are:
      * __data__: get file content, with content-type deduced from MIME type (file only).
      * __text__: get file content, as plain text (file only).
      * __metadata__: get file or directory metadata.
      * __list__: list directory content (directory only).
    * __paths__: comma separated sub-paths. Allows applying request on several files at same time (for __metadata__ & __list__ modes only).

### Route: POST /fs/api

Create resource on application file-system.

```javascript
// Example: upload file
var input = document.querySelector("input[type=file]")
input.onchange = function(event) {
  var files = input.files
  MsaFs.postFile(files, "/fs/api/target/dir/path", function(files_metadatas){
    console.log("Files has been uploaded.")
  })
}

// Example: create directory
Msa.post("/fs/api/dir/path", { query:{ type:'dir' }}, function(dir_metadata){
    console.log("Directory has been created.")
})
```

* __POST /fs/api/<path>__
  * __*path__: `String`, path to file/directory to upload/create.
  * __query__: possible keys are:
    * __type__: possible values are:
      * __file__: (default) upload file.
      * __dir__: create directory.
    * __paths__: comma separated sub-paths. Allows applying request on several files at same time (for __dir__ type only).

### Route: DELETE /fs/api

Delete resource on application file-system.

```javascript
// Example
Msa.delete("/fs/api/file/path", function(){
    console.log("File has been removed.")
})

* __DELETE /fs/api/<path>__
  * __*path__: `String`, path to file/directory to remove.
  * __query__: possible keys are:
    * __paths__: comma separated sub-paths. Allows applying request on several files at same time.

## SERVER API

### Function: msaFs.respondFile

Respond file to client.

```javascript
// Example
mySubApp.get("/myRoute", function(req, res, next) {
  msaFs.respondFile("/file/to/repond", res, next)
})
```

* __msaFs.respondFile__: `Function(path [, args], res, next)`
  * __*path__: `String`, path to file to send to client. If readStream is provided, path is used as file name.
  * __args__: `Object`, possible properties are:
    * __readStream__: `ReadStream`, readStream to send to client.
    * __mode__: `String`, defines the content type of the response. Poosible values are:
      * __"data"__ (default): The content type is determied from the MIME type.
      * __"text"__: The file is sent as plain text.
  * __*res__: `Express Res`
  * __*next__: `Function(err)`, called when something went wrong.

### Function: msaFs.receiveFile

Receive file from client.

```javascript
// Example
sheetApp.post('/attach', function(req, res, next) {
  fsApp.receiveFile(req,
    function(file, filename, fields) {
      console.log("File ", filename, "has been received.")
    },
    function(file, filename, fields) {
      res.json({done: true})
    }
  )
})
```

* __fsApp.receiveFile__: `Function(req, onFile, next)`
  * __*req__: `Express Request`
  * __*onFile__: `Function`, callback function called each time a file is detected.
  * __*next__: `Function`, callback function called when all files are received.

### Function: msaFs.createReadStream, msaFs.createWriteStream

Create file readStream, or writeStream.

```javascript
// Example
msaFs.createReadStream("/file/path", function(err, readStream){
  if(err) console.log("Error occured:", err)
  else console.log("File readStream:", readStream)
})
```

* __msaFs.createReadStream__: `Function(path, next)`
  * __*path__: `String`, file path from which readStream has to be created.
  * __next__: `Function(err, stream)`, callback function called when readStream is created.

### Function: msaFs.getMetadata

Return given file or directory metadata.

```javascript
// Example
msaFs.getMetadata("/file/path", function(err, metadata){
  if(err) console.log("Error occured:", err)
  else {
    console.log("File is a regular file:", metadata.type=='file')
    console.log("File is a directory:", metadata.type=='dir')
  }
})

* __msaFs.getMetadata__: `Function(path, next)`
  * __*path__: `String` or ``Array[String]``, file path from which metadata has to be retreived.
  * __next__: `Function(err, metadata)`, callback function called when readStream is created.
    * __metadata__: `Object`, possible properties are:
      * __name__: `String`, possible properties are
      * __type__: `String`, file type. Possible values are:
        * __"file"__: regular file.
        * __"dir"__: directory.
      * __size__: `Number`, filesize in octet.
      * __mime__: `String`, file mime type.

### Function: msaFs.list

List content of a directory.

```javascript
// Example
msaFs.rm("/dir/path", function(err, childs_metadatas){
  if(err) console.log("Error occured:", err)
  else {
    console.log("Directory contains these files:")
    for(var i=0, len=childs_metadatas.length; i<len; ++i)
      console.log(childs_metadatas[i].name)
  }
})
```

* __msaFs.list__: `Function(path, next)`
  * __*path__: `String`, directory path from which content has to be retreived.
  * __next__: `Function(err, childs_metadatas)`, callback function called when content is listed.
    * __childs_metadatas__: ``Array[String]``, it contains the metadata of each child file (see __msaFs.getMetadata__).

### Function: msaFs.upload

Upload file in given path.

```javascript
// Example
myApp.post("/upload", function(req, res, next){
  msaFs.upload(req, "/target/dir/path", function(err, filenames){
    if(err) next("Error occured:", err)
    else {
      console.log("These files have been uploaded:", filenames)
      res.sendStatus(200)
    }
  })
})
```

* __msaFs.upload__: `Function(req, path, next)`
  * __*req__: `Express req`, user request containing files to upload (in FormData).
  * __*path__: `String`, directory path where to upload files.
  * __next__: `Function(err, filenames)`, callback function called when files have been uploaded.
    * __filenames__: `Array[String]`, list file names that have been uploaded.

### Function: msaFs.mkdir

Create directory. Contrary to the legacy __fs.mkdir__ function, all the parent directories are created if needed, and the function does not return on error if the directory already exists.

```javascript
// Example
msaFs.mkdir("/directory/to/create", function(err){
  if(err) console.log("Error occured:", err)
  else console.log("Directory has been created.")
})
```

* __msaFs.mkdir__: `Function(path, next)`
  * __*path__: `String` or `Array[String]`, (list of) directory path to created.
  * __next__: `Function(err)`, callback function called when directory is created.

### Function: msaFs.remove

Remove file or directory.

```javascript
// Example
msaFs.remove("/file/to/remove", function(err){
  if(err) console.log("Error occured:", err)
  else console.log("File has been removed")
})
```

* __msaFs.remove__: `Function(path, next)`
  * __*path__: `String` or `Array[String]`, (list of) file or directory to remove.
  * __next__: `Function(err)`, callback function called when file is removed.

### Function: msaFs.serveFs

Update express subApp for it to serve file-system routes on specific directory.

```javascript
// Example
var mySubApp = Msa.subApp("/subAppRoute")
msaFs.serveFs({
  subApp: mySubApp,
  rootDir: "/root/directory",
  perm: { group: "admin" }
})
```

* __msaFs.serveFs__: `Function(args)`
  * __*args__: `Object`, possible properties are:
    * __*subApp__: `Express Subapp`, express subapp from which the file-system is served.
    * __subRoute__: `String`, sub-route from which the the file-system is served.
    * __rootDir__: `String`, directory that is served (default: App root directory).
    * __readPerm__: `UserExpr`, user having permission to read served files (default: admin users).
    * __writePerm__: `UserExpr`, user having permission to write served files (default: admin users).

## LICENSE
MIT
