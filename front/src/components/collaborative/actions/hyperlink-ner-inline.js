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


export default function hyperlinkNERInline(id,
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
    // curl -X POST "https://lincs-api.lincsproject.ca/api/link/reconcile" -d '{"entity": "Victor Hugo", "authorities": ["Wikidata", "LINCS-Person"], "moreResults": false}' -H "Content-Type: application/json" -H "Accept: application/json"
    // [{"authority":"Wikidata","matches":[{"uri":"http://www.wikidata.org/entity/Q535","label":"Victor Hugo","description":"French novelist, poet, dramatist and politician (1802–1885)"},{"uri":"http://www.wikidata.org/entity/Q1459231","label":"Victor Hugo","description":"Paris Métro station"},{"uri":"http://www.wikidata.org/entity/Q55714009","label":"Victor Hugo","description":"male given name"},{"uri":"http://www.wikidata.org/entity/Q3557372","label":"Victor Hugo","description":"Leon Gambetta-class armoured cruiser"}]},{"authority":"LINCS-Person","matches":[{"uri":"http://www.wikidata.org/entity/Q535","label":"Victor Hugo","description":""},{"uri":"http://id.lincsproject.ca/nN5LW0TIwir","label":"Hugo Torres","description":""},{"uri":"http://viaf.org/viaf/14328320","label":"Hugo Reid","description":""},{"uri":"http://viaf.org/viaf/283181724","label":"Hugo Laubach","description":""}]}]
    try {
      const response = await fetch("https://lincs-api.lincsproject.ca/api/link/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: originalText,
          authorities: ["Wikidata", "VIAF-Personal"], 
          moreResults: false,
        }),
      });

      const data = await response.json();
      
      const userSelection = await manualDesambiguisation(editor, data);
      console.log(userSelection); // returns the selected table line 
      if (userSelection) {
        // const authority = userSelection.authority;
        const uri = userSelection.uri;
        const label = clean(userSelection.label);
        // [le grand philosophe]{.personnalite id=”Platon” idwiki="https://www.wikidata.org/wiki/Q959”}
        const addURI = createInlineBlockCommand('ner', {
          attrs: null,
          body_pre: '[',
          body_post: `]("${uri}", "${label}")`,
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

          // Check if there are no matches at all
          const hasMatches = data.some(authority => authority.matches && authority.matches.length > 0);

          if (!hasMatches) {
            const noMatchesRow = document.createElement('tr');
            const noMatchesCell = document.createElement('td');
            noMatchesCell.textContent = 'No matches found';
            noMatchesCell.style.padding = '10px';
            noMatchesCell.style.textAlign = 'center';
            noMatchesRow.appendChild(noMatchesCell);
            widgetContent.appendChild(noMatchesRow);
            widget.domNode.appendChild(widgetContent);

            // Resolve with null or a custom object indicating no matches
            setTimeout(() => resolve(null), 500);
            return widget.domNode;
          }


          /// Loop through each authority in the data
          data.forEach((authority) => {
            // ---- authority header ----
            const headerRow = document.createElement('tr');
            const headerCell = document.createElement('th');
          
            headerCell.textContent = authority.authority;
            headerCell.colSpan = 1;
            headerCell.style.textAlign = 'left';
            headerCell.style.padding = '8px';
            headerCell.style.borderBottom = '1px solid #ddd';
            headerCell.style.backgroundColor = '#f5f5f5';
          
            headerRow.appendChild(headerCell);
            widgetContent.appendChild(headerRow);
          
            // ---- authority matches ----
            authority.matches.slice(0, 10).forEach((match) => {
              const index = allMatches.length;
          
              allMatches.push({ authority: authority.authority, match });
          
              const tr = document.createElement('tr');
              tr.dataset.selectable = 'true';
          
              const td = document.createElement('td');
              td.textContent = match.description;
              td.style.padding = '5px';
              td.style.cursor = 'pointer';
              td.style.borderBottom = '1px solid #eee';
          
              tr.appendChild(td);
              widgetContent.appendChild(tr);
              selectableRows.push(tr);
          
              td.onclick = () => {
                resolve({uri: match.uri, label: match.label, authority: authority.authority});
                editor.removeContentWidget(widget);
              };
            });
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

      // Function to handle clicks outside the widget
      const handleClickOutside = (event) => {
        if (widget.domNode && !widget.domNode.contains(event.target)) {
          resolve(null); // Resolve with null to indicate the user clicked outside
          editor.removeContentWidget(widget);
          document.removeEventListener('click', handleClickOutside);
        }
      };

      // Add event listener for clicks outside the widget
      document.addEventListener('click', handleClickOutside);



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