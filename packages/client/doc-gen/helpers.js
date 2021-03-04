/* override helper.params from the default jsdoc template(dmd)
so we can use italics instead of brackets to mark optional parameters */

function params (options) {
  if (this.params) {
    var list = this.params.map(function (param) {
      var nameSplit = param.name.split('.')
      var name = nameSplit[nameSplit.length - 1]
      if (param.variable) name = '...' + name
      if (param.optional) name = '*' + name + '*'
      return {
        indent: '    '.repeat(nameSplit.length - 1),
        name: name,
        type: param.type,
        defaultvalue: param.defaultvalue,
        description: param.description,
        optional: param.optional
      }
    })
    return options.fn(list)
  }
}

exports.params = params
