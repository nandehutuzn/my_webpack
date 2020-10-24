// 获取主入口文件内容
const fs = require('fs')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const path = require('path')
const babel = require('@babel/core')

const getModuleInfo = (file) => {
  const body = fs.readFileSync(file, 'utf-8')
  const ast = parser.parse(body, {
    sourceType: 'module' // 表示我们要解析的是es6模块
  })

  // console.log(ast)
  // console.log(ast.program.body)
  const deps = {} // 收集依赖路径
  // 遍历 AST树
  traverse(ast, {
    ImportDeclaration({ node }) {
      const dirname = path.dirname(file)
      const abspath = './' + path.join(dirname, node.source.value)
      // console.log(abspath)
      deps[node.source.value] = abspath
    }
  })
  // console.log(deps)

  const { code } = babel.transformFromAst(ast, null, {
    presets: ['@babel/preset-env']
  })
  const moduleInfo = { file, deps, code }
  // console.log(moduleInfo)

  return moduleInfo
}

const parseModules = (file) => {
  const depsGraph = {}
  // 获取文件信息
  const entry = getModuleInfo(file)
  const temp = [entry]
  for(let i = 0; i < temp.length; i++) {
    const deps = temp[i].deps
    if(deps) {
      // 遍历模块依赖， 递归获取模块信息
      for(const key in deps) {
        if(deps.hasOwnProperty(key)) {
          temp.push(getModuleInfo(deps[key]))
        }
      }
    }
  }

  temp.forEach(moduleInfo => {
    depsGraph[moduleInfo.file] = {
      deps: moduleInfo.deps,
      code: moduleInfo.code
    }
  })

  // console.log(depsGraph)
  return depsGraph
}

const bundle = file => {
  // 从入口文件开始，获取相关文件信息
  // 转成字符串，处理完两个关键字后 再返回字符串
  const depsGraph = JSON.stringify(parseModules(file))
  return `
    (function(graph){
      function require(file) {
        function absRequire(relPath) {
          return require(graph[file].deps[relPath])
        }
        var exports = {}
        
        Function('require', 'exports', graph[file].code)(absRequire, exports)

        return exports
      }

      require('${file}')
    })(${depsGraph})
  `
}

// getModuleInfo('./src/index.js')

// parseModules('./src/index.js')

const content = bundle('./src/index.js')

// 写入到 dist 目录下

fs.mkdirSync('./dist')
fs.writeFileSync('./dist/bundle.js', content)