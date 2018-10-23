module.exports = async (itf, next) => {
	try {
		await itf.installMsaMod("user", "msa-user")
	} catch(err) { return next(err) }
	next()
}
