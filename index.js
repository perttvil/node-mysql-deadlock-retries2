'use-strict'

var mysql = require('mysql')
var ER_LOCK_WAIT_TIMEOUT = 1205
var ER_LOCK_TIMEOUT = 1213

function proxyQuery(connection,retries,minMillis,maxMillis,debug) {
	retries = Number.isInteger(retries) ? retries : 5
	minMillis = Number.isInteger(minMillis) ? minMillis : 1
	maxMillis = Number.isInteger(maxMillis) ? maxMillis : 100

	var config = {}
	if (connection.config.connectionConfig) {
		config = connection.config.connectionConfig
		delete config.pool
	} else {
		config = connection.config
	}

	var conn = mysql.createConnection(config)
	connection.query = function(sql, values, cb) {
		if (typeof values == 'function') {
			cb = values
			values = []
		}

		var retry_copy = retries || 1

		var handleResponse = function(err,rows) {
			if (err && (err.errno == ER_LOCK_WAIT_TIMEOUT || err.errno == ER_LOCK_TIMEOUT)) {
				if (debug) console.log(`ERROR - ${ err.errno } ${ err.message }`)
				if (!--retry_copy) {
					if (debug) console.log(`Out of retries so just returning the error.`)
					return cb(err,rows)
				}
				var sleepMillis = Math.floor((Math.random()*maxMillis)+minMillis)

				if (debug) console.log('Retrying request with',retry_copy,'retries left. Timeout',sleepMillis)
				return setTimeout(function() {
					conn.query(sql, values, handleResponse)
				},sleepMillis)

			}

			return cb(err,rows)
		}

		conn.query(sql, values, handleResponse)
		
	}

}

module.exports = proxyQuery