/**
 * @description 自定义事件 插件
 * @author wangfupeng
 */

import ee, { Emitter } from 'event-emitter'
import { Editor } from 'slate'
import { IDomEditor, DomEditor } from './dom-editor'
import { EDITOR_TO_EMITTER } from '../utils/weak-maps'
import {
  EDITOR_TO_TEXTAREA,
  TEXTAREA_TO_EDITOR,
  TOOLBAR_TO_EDITOR,
  EDITOR_TO_TOOLBAR,
  EDITOR_TO_CONFIG,
  HOVER_BAR_TO_EDITOR,
  EDITOR_TO_HOVER_BAR,
} from '../utils/weak-maps'

/**
 * 获取 editor 的 emitter 实例
 * @param editor editor
 */
function getEmitter(editor: IDomEditor): Emitter {
  let emitter = EDITOR_TO_EMITTER.get(editor)
  if (emitter == null) {
    emitter = ee()
    EDITOR_TO_EMITTER.set(editor, emitter)
  }
  return emitter
}

// 记录下当前 editor 的 destroy listeners
const EDITOR_TO_DESTROY_LISTENERS: WeakMap<IDomEditor, Set<Function>> = new WeakMap()
function recordDestroyListeners(editor: IDomEditor, fn: Function) {
  let listeners = EDITOR_TO_DESTROY_LISTENERS.get(editor)
  if (listeners == null) {
    listeners = new Set<Function>()
    EDITOR_TO_DESTROY_LISTENERS.set(editor, listeners)
  }
  listeners.add(fn)
}
function getDestroyListeners(editor: IDomEditor): Set<Function> {
  return EDITOR_TO_DESTROY_LISTENERS.get(editor) || new Set()
}
function clearDestroyListeners(editor: IDomEditor) {
  EDITOR_TO_DESTROY_LISTENERS.set(editor, new Set())
}

export const withEmitter = <T extends Editor>(editor: T) => {
  const e = editor as T & IDomEditor

  // destroy
  e.destroy = () => {
    // 销毁相关实例（会销毁 DOM）
    const textarea = DomEditor.getTextarea(e)
    textarea.destroy()
    const toolbar = DomEditor.getToolbar(e)
    toolbar && toolbar.destroy()
    const hoverbar = DomEditor.getHoverbar(e)
    hoverbar && hoverbar.destroy()

    // 触发自定义事件
    e.emit('destroyed')
  }

  // 自定义事件
  e.on = (type, listener) => {
    const emitter = getEmitter(e)

    // 绑定事件
    emitter.on(type, listener)

    // destroyed 事件需要记录下来，以便最后统一 off 掉
    if (type === 'destroyed') recordDestroyListeners(e, listener)

    // editor 销毁时，取消绑定 - 重要
    if (type !== 'destroyed') {
      const fn = () => emitter.off(type, listener)
      emitter.on('destroyed', fn)
      recordDestroyListeners(e, fn) // 记录下来
    }
  }
  e.once = (type, listener) => {
    const emitter = getEmitter(e)
    emitter.once(type, listener)
  }
  e.off = (type, listener) => {
    const emitter = getEmitter(e)
    emitter.off(type, listener)
  }
  e.emit = type => {
    const emitter = getEmitter(e)
    emitter.emit(type)

    // editor 销毁时，off 掉 destroyed listeners
    if (type === 'destroyed') {
      const listeners = getDestroyListeners(e)
      // @ts-ignore
      listeners.forEach(fn => emitter.off('destroyed', fn))
      clearDestroyListeners(e) // 清空 destroyed listeners
    }
  }

  return e
}
