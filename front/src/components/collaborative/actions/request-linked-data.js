import { Range, Selection } from 'monaco-editor/esm/vs/editor/editor.api';
import createInlineBlockCommand from './inline-block.js'

/**
 * @typedef {import('monaco-editor').editor.IActionDescriptor} IActionDescriptor
 * @typedef {import('monaco-editor').editor.ICodeEditor} ICodeEditor
 */

/**
 * @param {string} id
 * @returns {IActionDescriptor}
 */
export default function requestLinkedData(id) {
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
            console.log(data);
        
            const uri = data[0].matches[0].uri; // Assuming the API returns a URI for the entity
            const label = data[0].matches[0].description;
            // Add annotation or decoration to the editor
            console.log('first match uri', uri);
            const addURI = createInlineBlockCommand('ner', {
                attrs: null,
                body_pre: '[', 
                body_post: `](${uri} "${label}")`,
                });
            addURI.run(editor);
            };

        return data; // Return the data for further processing
      } catch (error) {
        console.error("Error fetching data:", error);
        return null;
      }
    }
    return {
        id: `stylo--infratextual-markup--${id}`,
        label: `actions.infratextual-inline.${id}`,
        contextMenuGroupId: '1_modification',
        keybindingContext: null,
        contextMenuOrder: 1,
        enabled: true,
        keybindings: [],
        run,
      };
  }

