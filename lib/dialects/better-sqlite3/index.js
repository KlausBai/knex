// better-sqlite3 Client
// -------
const mapValues = require('lodash/mapValues');
const isArray = require('lodash/isArray');
const Client_SQLite3 = require('../sqlite3');

class Client_BetterSQLite3 extends Client_SQLite3 {
  _driver() {
    return require('better-sqlite3');
  }

  // Get a raw connection from the database, returning a promise with the connection object.
  async acquireRawConnection() {
    return new this.driver(this.connectionSettings.filename);
  }

  // Used to explicitly close a connection, called internally by the pool when
  // a connection times out or the pool is shutdown.
  async destroyRawConnection(connection) {
    return connection.close();
  }

  // Runs the query on the specified connection, providing the bindings and any
  // other necessary prep work.
  async _query(connection, obj) {
    if (!obj.sql) throw new Error('The query is empty');

    if (!connection) {
      throw new Error('No connection provided');
    }

    const statement = connection.prepare(obj.sql);
    const bindings = this._formatBindings(obj.bindings);

    if (statement.reader) {
      if(this.connectionSettings.supportBigNumbers) {
        statement.safeIntegers(true)
      }
      let response = await statement.all(bindings);
      if(this.connectionSettings.supportBigNumbers) {
        const bigNumberStrings = this.connectionSettings.bigNumberStrings
        const processBigintModeRow = (row) => {
          return mapValues(row,v=>{
            if(typeof v === 'bigint') {
              const numV = Number(v);
              if(numV == v) return numV;
              else {
                if(bigNumberStrings) return v.toString()
                else return v
              }
            }
            else return v
          })
        }
        if(isArray(response)) {
          response = response.map(r=>processBigintModeRow(r))
        } else {
          response = processBigintModeRow(response)
        }
      }
      obj.response = response;
      return obj;
    }

    const response = await statement.run(bindings);
    obj.response = response;
    obj.context = {
      lastID: response.lastInsertRowid,
      changes: response.changes,
    };

    return obj;
  }

  _formatBindings(bindings) {
    if (!bindings) {
      return [];
    }
    return bindings.map((binding) => {
      if (binding instanceof Date) {
        return binding.valueOf();
      }

      if (typeof binding === 'boolean') {
        return Number(binding);
      }

      return binding;
    });
  }
}

Object.assign(Client_BetterSQLite3.prototype, {
  // The "dialect", for reference .
  driverName: 'better-sqlite3',
});

module.exports = Client_BetterSQLite3;
