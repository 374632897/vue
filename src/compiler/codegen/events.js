/* @flow */

const simplePathRE = /^\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['.*?']|\[".*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*\s*$/

// keyCode aliases
const keyCodes = {
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  up: 38,
  left: 37,
  right: 39,
  down: 40,
  'delete': [8, 46]
}

const modifierCode = {
  stop: '$event.stopPropagation();',
  prevent: '$event.preventDefault();',
  self: 'if($event.target !== $event.currentTarget)return;'
}

export function genHandlers (events: ASTElementHandlers, native?: boolean): string {
  let res = native ? 'nativeOn:{' : 'on:{'
  for (const name in events) {
    res += `"${name}":${genHandler(events[name])},`
  }
  return res.slice(0, -1) + '}' // remove the last comma and append "}" to make it like an object literal
}
// src/compiler/parser/index.js processAttrs (el) ->
// src/compiler/helpers.js  addHandler(el, name, value, modifiers) ->
// src/compiler/codegen/index.js getHanlders(el.events)

function genHandler (
  handler: ASTElementHandler | Array<ASTElementHandler>
): string {
  // handler ->
  // { value: "addTodo", modifiers: { enter: true }}
  if (!handler) {
    return 'function(){}'
  } else if (Array.isArray(handler)) {
    return `[${handler.map(genHandler).join(',')}]` // 调用函数的toString()方法
  } else if (!handler.modifiers) { // 没有事件修饰符
    // <input type="" name="" v-model = 'message'> 这种情况下，
    // handler === {value: "if($event.target.composing)return;message=$event.target.value", modifiers: null}
    // message 之所以能够使用， 是因为使用 with 将它置于了组件的作用域下， 因此 message 将会是它的一个属性
    return simplePathRE.test(handler.value) // 这里是什么意思？
      ? handler.value
      : `function($event){${handler.value}}`
  } else {
    let code = '' // 修饰符组合对应的函数体
    const keys = []
    for (const key in handler.modifiers) {
      if (modifierCode[key]) {
        code += modifierCode[key]
      } else {
        keys.push(key)
      }
    }
    if (keys.length) {
      code = genKeyFilter(keys) + code
    }
    const handlerCode = simplePathRE.test(handler.value)
      ? handler.value + '($event)'
      : handler.value
    return 'function($event){' + code + handlerCode + '}'
  }
}

function genKeyFilter (keys: Array<string>): string {
  const code = keys.length === 1
    ? normalizeKeyCode(keys[0])
    : Array.prototype.concat.apply([], keys.map(normalizeKeyCode))
  if (Array.isArray(code)) {
    return `if(${code.map(c => `$event.keyCode!==${c}`).join('&&')})return;` // .enter.up 的情况下， 如果两个键没有同时按下， 则不执行
  } else {
    return `if($event.keyCode!==${code})return;`
  }
}

function normalizeKeyCode (key) {
  return (
    parseInt(key, 10) || // number keyCode
    keyCodes[key] || // built-in alias
    `_k(${JSON.stringify(key)})` // custom alias
  )
}
