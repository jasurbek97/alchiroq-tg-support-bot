const { Client } = require('pg')

const isPlainObject = (obj) => {
    return Object(obj) === obj && Object.getPrototypeOf(obj) === Object.prototype
}

const getProxy = (target, id, callback) => {
    var prop

    for (prop in target) {
        if (isPlainObject(target[prop])) {
            callback(id)
        }
    }

    return new Proxy(target, {
        set: function(obj, prop, value) {
            if (isPlainObject(value)) {
                obj[prop] = getProxy(value, id, callback);
            } else {
                obj[prop] = value
            }

            callback(id)

            return true
        }
    })
}


class PostgreSQLSession {

    constructor (connecty_params) {
        this.connecty_params = connecty_params

        this.connect_users = []
        this.session_ = {}

        return (ctx, next) => {

            const id = ctx.update.message ? ctx.update.message.from.id : ctx.update.callback_query.from.id

            if (!this.connect_users.includes(id)) {
                this.connect_users.push(id)
                this.session = getProxy(this.session_, id, ID => {
                    const pg = new Client(this.connecty_params)

                    pg.connect()
                    pg.query(`UPDATE telegraf_session SET session = '${JSON.stringify(this.session[ID])}' WHERE id = '${ID}'`, () => {
                        ctx.session = this.session[id]
                        pg.end()
                    })
                })
            }

            if (!this.session[id]) {

                const pg = new Client(this.connecty_params)
                pg.connect()
                pg.query(`SELECT session FROM telegraf_session WHERE id = '${id}'`, (err, data) => {
                    if (err) {
                        ctx.session = this.session[id] = {}
                        pg.end()
                        next()
                    }

                    if (data.rows.length == 0) {
                        pg.query(`INSERT INTO telegraf_session (id, session) VALUES ('${id}', '{}')`, err => {
                            ctx.session = this.session[id] = {}
                            pg.end()
                            next()
                        })
                        return
                    }

                    ctx.session = this.session[id] = JSON.parse(data.rows[0].session)

                    pg.end()
                    next()
                })
                return
            }

            ctx.session = this.session[id]
            next()
        }
    }
}

module.exports = PostgreSQLSession