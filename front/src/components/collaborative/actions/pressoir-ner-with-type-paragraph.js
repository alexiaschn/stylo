import { Range } from 'monaco-editor/esm/vs/editor/editor.api';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import createInlineBlockCommand from './inline-block.js';

/**
 * @typedef {import('monaco-editor').editor.IActionDescriptor} IActionDescriptor
 * @typedef {import('monaco-editor').editor.ICodeEditor} ICodeEditor
 */

/**
 * @param {string} id
 * @returns {IActionDescriptor}
 */
export default function pressoirNerParagraph(id, { keybindings = [] } = {}) {
  /**
   * @param {ICodeEditor} editor
   */
  async function run(editor) {
    let { startLineNumber, startColumn, endLineNumber, endColumn } = editor.getSelection();
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
      // for debug
      let round = 0;
      let offsetDelta = 0;
      // Step 2: For each entity, create a widget
      if (data.entities && data.entities.length > 0) {
        const sortedEntities = [...data.entities].sort((a, b) => a.matches[0].start - b.matches[0].start);

        for (const entity of sortedEntities) {
          for (const match of entity.matches) {

        // Store the original selection   
        startColumn = startColumn + offsetDelta;
        endColumn = endColumn + offsetDelta;
        let selection = {startLineNumber, startColumn, endLineNumber, endColumn}
        const originalModel = editor.getModel();
        const originalText = originalModel.getValueInRange(selection);

        // Sort entities by their start position to process them in order
        // Track the cumulative offset change
        ++round;
        console.log("nb de round avec delta", round, offsetDelta);
        console.log("selection range before sending new widget", selection);
      // Show the entity selection widget
      // selection = editor.getModel().getValueInRange(selection);
      console.log("longueur de la ligne", editor.getModel().getLineLength(selection.startLineNumber));
      const userSelectionType = await manualDesambiguisationType(editor, selection, entity, match);
      if (!userSelectionType) continue;
      console.log("after Type");
      // Fetch reconciliation data
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
      const userSelection = await manualDesambiguisation(editor, selection, desambiguisationdata, entity, match);
      if (!userSelection) continue;

      // Insert the inline block
      const addURI = createInlineBlockCommand('ner', {
        attrs: null,
        body_pre: '[',
        body_post: `]{.${userSelectionType.label} id="${userSelectionType.name}", id${userSelection.authority}="${userSelection.uri}"}`,
        startLineNumber: startLineNumber,
        startColumn: startColumn,
        endLineNumber: endLineNumber,
        endColumn: endColumn,
        offset_start: match.start,
        offset_end: match.end,
      });
      addURI.run(editor);
      // Calculate the delta introduced by the insertion
      const insertedText = `[]{.${userSelectionType.label} id="${userSelectionType.name}", id${userSelection.authority}="${userSelection.uri}"}`;
      const delta = insertedText.length - (match.end - match.start);
      offsetDelta += delta;

      // Restore the original selection for the next iteration
      editor.setSelection(selection);
    }
  }
}

    } catch (error) {
      console.error("Error:", error);
    }
  }
/**
 * @param {ICodeEditor} editor
 * @param {Object} entity
 * @param {Range} entityRange
 */
async function manualDesambiguisationType(editor, selection, entity, match) {
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

          widget.domNode.appendChild(widgetContent);

          tr.onclick = () => {
            resolve({ name: entity.name, label: entity.label });
            editor.removeContentWidget(widget);
          };
        }
        return widget.domNode;
      },
      getPosition: () => {
        return {
          
        position: {
          lineNumber: selection.startLineNumber,
          column: selection.startColumn + (match.end - match.start),
        },
        preference: ['below'],
        };
      },
    };

    console.log("widget type before send");

    editor.addContentWidget(widget);
    console.log("widget type sent");

    document.addEventListener('click', (event) => {
      if (widget.domNode && !widget.domNode.contains(event.target)) {
        resolve(null);
        editor.removeContentWidget(widget);
      }
    });
  });
}
  /**
   * @param {ICodeEditor} editor
   * @param {Array} desambiguisationdata
  //  @param {Range} entityRange
   */
  async function manualDesambiguisation(editor,selection, desambiguisationdata, entity, entrange) {
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

            desambiguisationdata.forEach((authority) => {
              authority.matches.slice(0, 10).forEach((match) => {
                const tr = document.createElement('tr');
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
        getPosition: () => {
          return {
            
          position: {
            lineNumber: selection.startLineNumber,
            column: selection.startColumn + entrange.end,
          },
          preference: ['below'],
          };
        },
      };

      editor.addContentWidget(widget);
      document.addEventListener('click', (event) => {
        if (widget.domNode && !widget.domNode.contains(event.target)) {
          resolve(null);
          editor.removeContentWidget(widget);
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
