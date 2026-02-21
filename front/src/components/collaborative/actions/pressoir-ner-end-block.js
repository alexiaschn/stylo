import { Range } from 'monaco-editor/esm/vs/editor/editor.api';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
// import createInlineBlockCommand from './inline-block.js';
import createEndBlockComment from './end-block.js'

/**
 * @typedef {import('monaco-editor').editor.IActionDescriptor} IActionDescriptor
 * @typedef {import('monaco-editor').editor.ICodeEditor} ICodeEditor
 */

/**
 * @param {string} id
 * @returns {IActionDescriptor}
 */
export default function pressoirNerEndBlockCommand(id, 
  {
    keybindings = [],

  })
  {
  /**
   * @param {ICodeEditor} editor
   */
  async function run(editor) {
    const { startLineNumber, startColumn, endLineNumber, endColumn } = editor.getSelection();
    const range = new Range(startLineNumber, startColumn, endLineNumber, endColumn);
    const originalText = editor.getModel().getValueInRange(range) || '';
    console.log("Request function sent for ", originalText);

    try {
      // Step 1: Fetch entity types and names
      const response = await fetch("https://lincs-api.lincsproject.ca/api/ner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: originalText,
          language: "fr"
        }),
      });

      const data = await response.json();
      console.log("Retrieved entities", data);
       // Step 2: For each entity, create a widget
       if (data.entities && data.entities.length > 0) {
        // const selection = editor.getSelection();

        const sortedEntities = [...data.entities].sort((a, b) => a.matches[0].start - b.matches[0].start);

        for (const entity of sortedEntities) {
          try {
          for (const match of entity.matches) {
            const userSelectionType = await manualDesambiguisationType(editor, entity, match);
            if (!userSelectionType) {
              console.log("User cancelled or no selection for entity type");
              continue;
            }
            // Step 3: Fetch URI for selected entity
            const reconcileResponse = await fetch("https://lincs-api.lincsproject.ca/api/link/reconcile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                entity: userSelectionType.name,
                authorities: ["Wikidata"],
                moreResults: false,
              }),
            });

          const desambiguisationdata = await reconcileResponse.json();
          console.log("Reconciliation data:", desambiguisationdata);

          // Step 4: Show URI selection widget
          const userSelection = await manualDesambiguisation(editor, desambiguisationdata, match);
          if (!userSelection) continue; // User cancelled or no selection
          console.log("final user selection", userSelection);
        
          // Step 5: Insert the selected URI and description into the editor
          const addURI = createEndBlockComment('ner', {
            attrs: null,
            user: "Test User",
            entity: {
              label: userSelectionType.label, 
              id: userSelectionType.name,
              authority: userSelection.authority,
              uri: userSelection.uri,
            }, 
            start: match.start,
            end:match.end
          });
          addURI.run(editor);
          // editor.setSelection(selection);

        }
      } catch (error) {
        console.error("Error in match loop:", error);
      }
      }
    }
        
        } catch (error) {
          console.error("Error:", error);
        }
      }

  /**
   * @param {ICodeEditor} editor
   * @param {Array} data
   */
  async function manualDesambiguisationType(editor, entity, match) {
    return new Promise((resolve) => {
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

            const widgetContent = document.createElement('table');
            widgetContent.style.borderCollapse = 'collapse';
            widgetContent.style.width = '100%';


              const tr = document.createElement('tr');
              tr.dataset.selectable = 'true';

              const tdName = document.createElement('td');
              tdName.textContent = entity.name;
              tdName.style.padding = '5px';
              tdName.style.cursor = 'pointer';
              tdName.style.borderBottom = '1px solid #eee';

              const tdLabel = document.createElement('td');
              tdLabel.textContent = entity.label;
              tdLabel.style.padding = '5px';
              tdLabel.style.cursor = 'pointer';
              tdLabel.style.borderBottom = '1px solid #eee';

              tr.appendChild(tdName);
              tr.appendChild(tdLabel);
              widgetContent.appendChild(tr);

              tr.onclick = () => {
                resolve({ name: entity.name, label: entity.label });
                editor.removeContentWidget(widget);
              };
            widget.domNode.appendChild(widgetContent);
          }
          return widget.domNode;
        },
        getPosition: () => {
          const selection = editor.getSelection();
          const pos = {
            position: {
              lineNumber: selection.endLineNumber,
              column: selection.startColumn + match.start,
            },
            preference: ['below'],
          };
          // console.log("Widget position:", pos);
          return pos;
        },
      };

      editor.addContentWidget(widget);
      document.addEventListener('click', (event) => {
        if (widget.domNode && !widget.domNode.contains(event.target)) {
          setTimeout(() => {
            resolve(null);
            editor.removeContentWidget(widget);
          }, 10000);
        }
      });
      
    });
  }

  /**
   * @param {ICodeEditor} editor
   * @param {Array} desambiguisationdata
   */
  async function manualDesambiguisation(editor, desambiguisationdata, match) {
    return new Promise((resolve) => {
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

            const widgetContent = document.createElement('table');
            widgetContent.style.borderCollapse = 'collapse';
            widgetContent.style.width = '100%';

            // const hasMatches = desambiguisationdata.some(authority => authority.matches && authority.matches.length > 0);
            // if (!hasMatches) {
            //   const noMatchesRow = document.createElement('tr');
            //   const noMatchesCell = document.createElement('td');
            //   noMatchesCell.textContent = 'No matches found';
            //   noMatchesCell.style.padding = '10px';
            //   noMatchesCell.style.textAlign = 'center';
            //   noMatchesRow.appendChild(noMatchesCell);
            //   widgetContent.appendChild(noMatchesRow);
            //   widget.domNode.appendChild(widgetContent);
            //   setTimeout(() => resolve(null), 500);
            //   return widget.domNode;
            // }

            desambiguisationdata.forEach((authority) => {
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

              authority.matches.slice(0, 10).forEach((match) => {
                const tr = document.createElement('tr');
                tr.dataset.selectable = 'true';

                const td = document.createElement('td');
                td.textContent = match.description;
                td.style.padding = '5px';
                td.style.cursor = 'pointer';
                td.style.borderBottom = '1px solid #eee';

                tr.appendChild(td);
                widgetContent.appendChild(tr);

                td.onclick = () => {
                  resolve({ uri: match.uri, label: match.label, authority: authority.authority });
                  editor.removeContentWidget(widget);
                };
              });
            });

            widget.domNode.appendChild(widgetContent);
          }
          return widget.domNode;
        },
        // position of the widget : relative to selection
        getPosition: () => {
          const selection = editor.getSelection();
          const pos = {
            position: {
              lineNumber: selection.endLineNumber,
              column: selection.startColumn + match.start,
            },
            preference: ['below'],
          };
          console.log("Widget position:", pos);
          return pos;
        },
      };

      editor.addContentWidget(widget);
      document.addEventListener('click', (event) => {
        if (widget.domNode && !widget.domNode.contains(event.target)) {
          setTimeout(() => {
            resolve(null);
            editor.removeContentWidget(widget);
          }, 10000);
        }
      });
    });
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
