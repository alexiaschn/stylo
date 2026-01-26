import { Range, Selection } from 'monaco-editor/esm/vs/editor/editor.api';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import createInlineBlockCommand from './inline-block.js'

/**
 * @typedef {import('monaco-editor').editor.IActionDescriptor} IActionDescriptor
 * @typedef {import('monaco-editor').editor.ICodeEditor} ICodeEditor
 */


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


export default function requestLinkedData(id, 
  {
    keybindings = [],

  }
) {
  /**
   * @param {ICodeEditor} editor
   */
  async function run(editor) {
    console.log("request function sent");
    const { startLineNumber, startColumn, endLineNumber, endColumn } =
      editor.getSelection()

    const range = new Range(
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn
    )

    const originalText = editor.getModel().getValueInRange(range) || ''
   
    try {
        const response = await fetch(
          "https://lincs-api.lincsproject.ca/api/link/reconcile",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              entity: originalText,
              authorities: ["Wikidata"],
              moreResults: false,
            }),
          }
        );
  
        const data = await response.json();
        if (data[0]?.matches && data[0].matches.length > 0) {
          const userSelection = await manualDesambiguisation(editor, data[0].matches);
          if (userSelection) {
            const uri = userSelection.uri;
            const label = clean(userSelection.description);
            const addURI = createInlineBlockCommand('ner', {
              attrs: null,
              body_pre: '[',
              body_post: `](${uri} "${label}")`,
            });
            addURI.run(editor);
          }
            }
          } catch (error) {
            console.error("Error fetching data:", error);
          }
        }


    /**
   * @param {ICodeEditor} editor
   * @param {Array} matches
   */
    async function manualDesambiguisation(editor, matches) {
      return new Promise((resolve) => {
        const widget = {
          domNode: null,
          getId: () => 'ner.suggest.widget',
          getDomNode: () => {
            if (!widget.domNode) {
              widget.domNode = document.createElement('div');
              widget.domNode.style.position = 'absolute';
              widget.domNode.style.backgroundColor = 'white';
              widget.domNode.style.border = '1px solid #ccc';
              widget.domNode.style.zIndex = '1000';
  
              matches.forEach((match, index) => {
                const item = document.createElement('div');
                item.textContent = match.description;
                item.style.padding = '5px';
                item.style.cursor = 'pointer';
                item.onclick = () => {
                  resolve(match);
                  editor.removeContentWidget(widget);
                };
                widget.domNode.appendChild(item);
              });
            }
            return widget.domNode;
          },
          getPosition: () => {
            const selection = editor.getSelection();
            return {
              position: {
                lineNumber: selection.endLineNumber,
                column: selection.endColumn,
              },
              preference: [monaco.editor.ContentWidgetPositionPreference.BELOW]
            };
          }
        };
  
        editor.addContentWidget(widget);
      });
    }
  function clean(label) {
    return label.replace(/"/, "'");
  }


  return {
    id: `stylo--infratextual-markup--${id}`,
    label: `actions.infratextual-inline.${id}`,
    contextMenuGroupId: '1_modification',
    keybindingContext: null,
    contextMenuOrder: 1,
    enabled: true,
    keybindings,
    run,
  };

}



