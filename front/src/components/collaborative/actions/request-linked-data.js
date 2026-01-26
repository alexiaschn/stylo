import { Range, Selection } from 'monaco-editor/esm/vs/editor/editor.api';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import createInlineBlockCommand from './inline-block.js'


// available authorities ["DBpedia-All","DBpedia-Event","DBpedia-Organisation","DBpedia-Person","DBpedia-Place","DBpedia-Work","Geonames","Getty-All","Getty-AAT","Getty-CONA","Getty-TGN","Getty-ULAN","GND-Organisation","GND-Person","GND-Place","GND-Subject","GND-Work","LINCS-All","LINCS-Person","LINCS-Place","LINCS-Work","LINCS-Group","LINCS-Event","VIAF-Bibliographic","VIAF-Corporate","VIAF-Expressions","VIAF-Geographic","VIAF-Personal","VIAF-Works","Wikidata"]
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
          authorities: ["Wikidata", "LINCS-All"], 
          moreResults: false,
        }),
      });

      const data = await response.json();
      
      const userSelection = await manualDesambiguisation(editor, data);
      console.log(userSelection); // returns the selected table line 
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
      
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  /**
   * @param {ICodeEditor} editor
   * @param {Array} data
   */
  async function manualDesambiguisation(editor, data) {
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
            widget.domNode.style.maxHeight = '300px';
            widget.domNode.style.width = '200px';
            // widget.domNode.style.overflowY = 'auto';

            // Add content to the widget, max 10 items per authority
            const widgetContent = document.createElement('table');
            widgetContent.style.borderCollapse = 'collapse';
            widgetContent.style.width = '100%';

            // Array to store all matches with their authority
          const allMatches = [];
          const selectableRows = [];


          /// Loop through each authority in the data
          data.forEach((authority) => {
            // Create a header row for the authority
            const authorityHeader = document.createElement('tr');
            const authorityHeaderCell = document.createElement('th');
            authorityHeaderCell.textContent = authority.authority;
            authorityHeaderCell.colSpan = 1;
            authorityHeaderCell.style.textAlign = 'left';
            authorityHeaderCell.style.padding = '8px';
            authorityHeaderCell.style.borderBottom = '1px solid #ddd';
            authorityHeaderCell.style.backgroundColor = '#f5f5f5';
            authorityHeader.appendChild(authorityHeaderCell);
            widgetContent.appendChild(authorityHeader);

            // Add matches for the authority, max 10
            authority.matches.slice(0, 10).forEach((match) => {
              allMatches.push({ authority: authority.authority, match });
            });
          });
            // Add all matches to the table
          allMatches.forEach((entry, index) => {
            const tr = document.createElement('tr');
            tr.dataset.selectable = 'true';

            const descriptionCell = document.createElement('td');
            descriptionCell.textContent = entry.match.description;
            descriptionCell.style.padding = '5px';
            descriptionCell.style.cursor = 'pointer';
            descriptionCell.style.borderBottom = '1px solid #eee';
            descriptionCell.style.backgroundColor =
              index === widget.selectedIndex ? '#e0e0e0' : 'transparent';


            tr.appendChild(descriptionCell);
            widgetContent.appendChild(tr);
            selectableRows.push(tr);


            descriptionCell.onclick = () => {
              resolve(entry.match); // Resolve with the selected match
              editor.removeContentWidget(widget);
            };

          });

          widget.domNode.appendChild(widgetContent);

          // Function to update the selected item's appearance
          const updateSelection = () => {
            
            selectableRows.forEach((row, index) => {
              const cell = row.firstElementChild;
              cell.style.backgroundColor =
                index === widget.selectedIndex ? '#e0e0e0' : 'transparent';
            });
          };
          
          // Add keyboard event listener
          widget.domNode.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
              e.preventDefault();
              e.stopImmediatePropagation();
            }
            if (e.key === 'ArrowUp' && widget.selectedIndex > 0) {
              widget.selectedIndex--;
              updateSelection();
            } else if (e.key === 'ArrowDown' && widget.selectedIndex < selectableRows.length - 1) {
              widget.selectedIndex++;
              updateSelection();
            } else if (e.key === 'Enter' && selectableRows.length > 0) {
              const selectedMatch = allMatches[widget.selectedIndex].match;
              resolve(selectedMatch); // Resolve with the selected match
              editor.removeContentWidget(widget);
            }
          }, true
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

  function clean(description) {
    return description.replace(/"/g, "'");
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