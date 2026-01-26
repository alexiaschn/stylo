import { Range, Selection } from 'monaco-editor/esm/vs/editor/editor.api';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import createInlineBlockCommand from './inline-block.js'

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
) 
{  /**
   * @param {ICodeEditor} editor
   */
  async function run(editor) {
    const { startLineNumber, startColumn, endLineNumber, endColumn } = editor.getSelection();
    const range = new Range(startLineNumber, startColumn, endLineNumber, endColumn);
    const originalText = editor.getModel().getValueInRange(range) || '';
    console.log("Request function sent for ", originalText);

    try {
      const response = await fetch("https://lincs-api.lincsproject.ca/api/link/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: originalText,
          authorities: ["Wikidata"],
          moreResults: false,
        }),
      });

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
      // Create the widget object
      const widget = {
        domNode: null,
        selectedIndex: 0,
        getId: () => 'ner.suggest.widget',
        getDomNode: () => {
          if (!widget.domNode) {
            widget.domNode = document.createElement('div');
            widget.domNode.style.position = 'absolute';
            widget.domNode.style.backgroundColor = 'white';
            widget.domNode.style.border = '1px solid black';
            widget.domNode.style.zIndex = '1000';
            widget.domNode.style.width = '200px';


            // Add items to the widget, max 10 items
            matches.slice(0,10).forEach((match, index) => {
              const item = document.createElement('div');
              item.textContent = match.description;
              item.style.padding = '5px';
              item.style.cursor = 'pointer';
              item.style.backgroundColor = index === widget.selectedIndex ? '#e0e0e0' : 'transparent';
              item.onclick = () => {
                resolve(match);
                editor.removeContentWidget(widget);
              };
              widget.domNode.appendChild(item);
            });

            // Function to update the selected item's appearance
            const updateSelection = () => {
              const items = widget.domNode.querySelectorAll('div');
              items.forEach((item, index) => {
                item.style.backgroundColor = index === widget.selectedIndex ? '#e0e0e0' : 'transparent';
              });
            };

            // Add keyboard event listener
            widget.domNode.addEventListener(
              'keydown',
              (e) => {
                if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
                  e.preventDefault();
                  e.stopImmediatePropagation();
                }
            
                if (e.key === 'ArrowUp' && widget.selectedIndex > 0) {
                  widget.selectedIndex--;
                  updateSelection();
                } else if (e.key === 'ArrowDown' && widget.selectedIndex < matches.length - 1) {
                  widget.selectedIndex++;
                  updateSelection();
                } else if (e.key === 'Enter') {
                  resolve(matches[widget.selectedIndex]);
                  editor.removeContentWidget(widget);
                }
              },
              true // 👈 capture phase
            );
            
            // Focus the widget so it can receive keyboard events
            widget.domNode.tabIndex = 0;
            widget.domNode.focus();
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
            preference: ['below'],
          };
        },
      };

      // Add the widget to the editor
      editor.addContentWidget(widget);
      // forcing refocusing 
      requestAnimationFrame(() => {
        widget.domNode?.focus();
      });
    });
  }

  function clean(label) {
    return label.replace(/"/g, "'");
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