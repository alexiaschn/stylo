import { Range, Selection } from 'monaco-editor/esm/vs/editor/editor.api'

import { blockAttributes } from './index.js'

/**
 * @typedef {import('monaco-editor').editor.IActionDescriptor} IActionDescriptor
 * @typedef {import('monaco-editor').editor.ICodeEditor} ICodeEditor
 */
 
/**
 * @param {string} id
 * @param {object} opts
 * @param {string?} opts.label
 * @param {string?} opts.contextMenuGroupId
 * @param {number?} opts.keybindings
 * @param {string?} opts.className
 * @param {{[key: string]: string}?} opts.attrs
 * @param {string?} opts.body_pre
 * @param {string?} opts.body_post
 * @returns {IActionDescriptor}
 */
export default function createEndBlockComment(
  id,
  {
    label = undefined,
    contextMenuGroupId = '1_modification',
    keybindings = [],
    className = undefined,
    attrs = {},
    user = undefined,
    entity,
    start,
    end,
  } = {}
) {
  /**
   * @param {ICodeEditor} editor
   */
  function run(editor) {
    const { startLineNumber, startColumn, endLineNumber, endColumn } =
      editor.getSelection()

    const entityStartLineNumber = startLineNumber;
    const entityStartColumn = startColumn + start;
    const entityEndLineNumber = endLineNumber;
    const entityEndColumn = entityStartColumn + end;

    // add to the last line

    // Source - https://stackoverflow.com/a/68863504
    // Posted by Rom1
    // Retrieved 2026-02-20, License - CC BY-SA 4.0

    const lastLine = editor.getModel().getLineCount();

    const range = new Range(
      lastLine, 
      1,
      lastLine,
      1
    );
    let content = `@${user}: .${entity.label} id="${entity.id}" uri=${entity.uri} authority=${entity.authority} lineStart=${entityStartLineNumber} lineEnd=${entityEndLineNumber} span=${entityStartColumn},${entityEndColumn}
`;
    if (firstAnnotation) {
      content = `---
` + content;
    }
    
    function firstAnnotation() {
      // return true if there are no line containing --- only 
      return true
    }


    // const originalText = editor.getModel().getValueInRange(range) || ''
    // const attributes = blockAttributes({ classNames: [className ?? id], attrs })
    // const bodyParts = [body_pre, originalText, body_post].filter((d) => d)

    
    editor.executeEdits(
      id,
      [
        {
          range: range,
          text: content,
          // forceMoveMarkers: true,
        },
      ],
      [
        new Selection(
          startLineNumber, startColumn, endLineNumber, endColumn
        )
      ]
    )
  }
  return {
    id: `stylo--infratextual-markup--${id}`,
    label: label ?? `actions.infratextual-inline.${id}`,
    contextMenuGroupId,
    keybindingContext: null,
    contextMenuOrder: 1,
    enabled: true,
    keybindings,
    run,
  }
}
