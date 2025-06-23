import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import BlockEditor from './BlockEditor';

const BlockList = ({ 
  boxes, 
  onDragEnd, 
  disabled = false,
  isCurrentPageCorrected = false 
}) => {
  const [selectedBlock, setSelectedBlock] = useState(null);

  // Convert boxes to block format
  const blocks = boxes.map(box => ({
    id: box.self_ref,
    type: box.type || 'text',
    content: box.content || '',
    metadata: box.metadata || {},
    bbox: box.bbox
  }));

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    onDragEnd(result);
  };

  const handleBlockUpdate = (blockId, updates) => {
    // Find the corresponding box and update it
    const boxIndex = boxes.findIndex(box => box.self_ref === blockId);
    if (boxIndex !== -1) {
      const updatedBoxes = [...boxes];
      const currentBox = updatedBoxes[boxIndex];
      
      updatedBoxes[boxIndex] = {
        ...currentBox,
        content: updates.content,
        metadata: updates.metadata || currentBox.metadata
      };
      
      // Since onDragEnd from App.js expects the full reordered array, 
      // we pass the updated array here.
      onDragEnd(updatedBoxes);
    }
  };

  const handleBlockDelete = (blockId) => {
    const updatedBoxes = boxes.filter(box => box.self_ref !== blockId);
    onDragEnd(updatedBoxes);
  };

  const handleBlockDuplicate = (blockId) => {
    const boxIndex = boxes.findIndex(box => box.self_ref === blockId);
    if (boxIndex > -1) {
      const boxToDuplicate = boxes[boxIndex];
      const newBox = {
        ...boxToDuplicate,
        self_ref: `${boxToDuplicate.self_ref}_copy_${Date.now()}` // More robust unique ID
      };
      const updatedBoxes = [...boxes];
      updatedBoxes.splice(boxIndex + 1, 0, newBox);
      onDragEnd(updatedBoxes);
    }
  };

  if (disabled || isCurrentPageCorrected) {
    return (
      <div className="block-list p-4 bg-gray-100 rounded-lg border border-gray-200">
        <div className="disabled-message text-center">
          <div className="message-content text-gray-600">
            <span className="block font-semibold text-lg">📝 This page is marked as corrected</span>
            <span className="text-sm mt-1">Click "Edit Again" to modify the order.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="blocks">
        {(provided) => (
          <div 
            className="block-list space-y-4"
            {...provided.droppableProps}
            ref={provided.innerRef}
          >
            {blocks.map((block, index) => (
              <Draggable key={block.id} draggableId={block.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                  >
                    <BlockEditor
                      block={block}
                      isSelected={selectedBlock === block.id}
                      onUpdate={(updates) => handleBlockUpdate(block.id, updates)}
                      onSelect={() => setSelectedBlock(block.id)}
                      onDelete={() => handleBlockDelete(block.id)}
                      onDuplicate={() => handleBlockDuplicate(block.id)}
                      dragHandleProps={provided.dragHandleProps}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default BlockList; 