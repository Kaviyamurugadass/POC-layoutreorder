import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

function Dragnew({ boxes, disabled, onDragEnd }) {
  if (disabled) {
    return (
      <div className="order-list disabled p-4 bg-gray-100 rounded border border-gray-300 text-gray-500">
        <div className="disabled-message text-center">
          <div className="message-content">
            <span className="block text-lg font-semibold">📝 This page is marked as corrected</span>
            <span className="block text-sm text-gray-400">Click "Edit Again" to modify the order</span>
          </div>
        </div>
      </div>
    );
  }

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    onDragEnd(result);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="order-list">
        {(provided) => (
          <div
            className="order-list space-y-2"
            {...provided.droppableProps}
            ref={provided.innerRef}
          >
            {boxes.map((box, index) => (
              <Draggable key={box.self_ref} draggableId={box.self_ref} index={index}>
                {(provided, snapshot) => (
                  <div
                    className={`list-item flex items-center gap-2 p-3 rounded-md border border-gray-300 bg-white shadow-sm ${
                      snapshot.isDragging ? 'bg-blue-50 shadow-md' : ''
                    }`}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <span className="order-num text-gray-500 font-bold">{index + 1}.</span>
                    <span className="text flex-1">{box.text}</span>
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
}

export default Dragnew;
