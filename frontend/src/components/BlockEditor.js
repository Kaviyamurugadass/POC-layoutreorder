import React, { useState, useRef, useEffect } from 'react';

// Icon components
const Hash = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
  </svg>
);

const Type = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
  </svg>
);

const Image = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <circle cx="8.5" cy="8.5" r="1.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15l-5-5L5 21" />
  </svg>
);

const Table = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const FileText = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const Edit3 = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const Trash2 = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="3,6 5,6 21,6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
  </svg>
);

const GripVertical = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="19" r="1" />
  </svg>
);

const Check = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="20,6 9,17 4,12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
);

const X = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
);

const blockTypeIcons = {
  section_header: Hash,
  text: Type,
  picture: Image,
  table: Table,
  caption: FileText
};

const blockTypeConfig = {
  section_header: { 
    color: 'from-blue-500 to-blue-600', 
    bg: 'bg-blue-50 border-blue-200', 
    badge: 'bg-blue-100 text-blue-800',
    ring: 'ring-blue-500'
  },
  text: { 
    color: 'from-emerald-500 to-emerald-600', 
    bg: 'bg-emerald-50 border-emerald-200', 
    badge: 'bg-emerald-100 text-emerald-800',
    ring: 'ring-emerald-500'
  },
  picture: { 
    color: 'from-purple-500 to-purple-600', 
    bg: 'bg-purple-50 border-purple-200', 
    badge: 'bg-purple-100 text-purple-800',
    ring: 'ring-purple-500'
  },
  table: { 
    color: 'from-orange-500 to-orange-600', 
    bg: 'bg-orange-50 border-orange-200', 
    badge: 'bg-orange-100 text-orange-800',
    ring: 'ring-orange-500'
  },
  caption: { 
    color: 'from-gray-500 to-gray-600', 
    bg: 'bg-gray-50 border-gray-200', 
    badge: 'bg-gray-100 text-gray-800',
    ring: 'ring-gray-500'
  }
};

const BlockEditor = ({
  block,
  isSelected,
  onUpdate,
  onSelect,
  onDelete,
  onDuplicate,
  dragHandleProps = null
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(block.content);
  const [editCaption, setEditCaption] = useState(block.metadata?.caption || '');
  const textareaRef = useRef(null);

  const IconComponent = blockTypeIcons[block.type] || Type;
  const config = blockTypeConfig[block.type] || blockTypeConfig.text;

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize textarea
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }, [isEditing]);

  // Update local state when block content changes from outside
  useEffect(() => {
    setEditContent(block.content);
    setEditCaption(block.metadata?.caption || '');
  }, [block.content, block.metadata?.caption]);

  const handleSave = () => {
    const updates = { content: editContent };
    if (block.type === 'picture' && editCaption !== block.metadata?.caption) {
      updates.metadata = { ...block.metadata, caption: editCaption };
    }
    onUpdate(updates);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(block.content);
    setEditCaption(block.metadata?.caption || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  const renderContent = () => {
    if (isEditing) {
      return (
        <div className="space-y-4">
          {block.type === 'picture' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {typeof block.content === 'string' && block.content.startsWith('data:image/') ? 'Base64 Image Data' : 'Image URL/Reference'}
                </label>
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder={typeof block.content === 'string' && block.content.startsWith('data:image/') ? "Base64 image data..." : "Enter image URL or reference..."}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Caption
                </label>
                <input
                  type="text"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter image caption..."
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {block.type === 'table' ? 'Table Content' : 'Content'}
              </label>
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                rows={block.type === 'table' ? 6 : 3}
                placeholder={block.type === 'table' ? "Enter table content..." : "Enter content..."}
              />
            </div>
          )}
          
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-all shadow-sm"
            >
              <Check className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-all"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <div className="text-xs text-gray-500 ml-auto">
              Press Esc to cancel • Cmd+Enter to save
            </div>
          </div>
        </div>
      );
    }

    if (block.type === 'picture') {
      return (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl bg-gray-100">
            {block.content && block.content.startsWith('data:image/') ? (
              <img
                src={block.content}
                alt={block.metadata?.caption || 'Image'}
                className="max-w-full transition-transform hover:scale-105"
              />
            ) : (
              <div className="w-full h-32 bg-gray-200 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm">Image not available</p>
                </div>
              </div>
            )}
          </div>
          {block.metadata?.caption && (
            <p className="text-sm text-gray-600 italic leading-relaxed">
              {block.metadata.caption}
            </p>
          )}
          {/* Show image info if it's a reference */}
          {block.content && !block.content.startsWith('data:image/') && (
            <p className="text-xs text-gray-500">
              Image Reference: {block.content}
            </p>
          )}
        </div>
      );
    }

    if (block.type === 'table') {
      return (
        <div className="prose prose-sm max-w-none">
          <div className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto">
            <div className="whitespace-pre-wrap text-gray-800 leading-relaxed font-mono text-sm">
              {block.content}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="prose prose-sm max-w-none">
        <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
          {block.content}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`
        relative group border-2 rounded-xl p-6 cursor-pointer transition-all duration-300
        ${config.bg}
        ${isSelected ? `ring-2 ${config.ring} ring-offset-2 shadow-lg` : 'hover:shadow-md'}
      `}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute left-3 top-3 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-grab active:cursor-grabbing z-10"
        >
          <div className="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center hover:shadow-lg transition-shadow">
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      )}

      {/* Block Type Badge */}
      <div className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 ${dragHandleProps ? 'ml-10' : ''}
        ${config.badge}
      `}>
        <div className={`w-4 h-4 bg-gradient-to-r ${config.color} rounded flex items-center justify-center`}>
          <IconComponent className="w-2.5 h-2.5 text-white" />
        </div>
        {block.type.replace('_', ' ')}
      </div>

      {/* Action Buttons */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-2 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="w-8 h-8 bg-white rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center hover:bg-blue-50 group/btn"
          title="Edit block"
        >
          <Edit3 className="w-3.5 h-3.5 text-gray-600 group-hover/btn:text-blue-600" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-8 h-8 bg-white rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center hover:bg-red-50 group/btn"
          title="Delete block"
        >
          <Trash2 className="w-3.5 h-3.5 text-gray-600 group-hover/btn:text-red-600" />
        </button>
      </div>

      {/* Content */}
      <div className="mt-2">
        {renderContent()}
      </div>

      {/* Bounding Box Info */}
      {/* {block.bbox && (
        <div className="mt-4 px-3 py-2 bg-white/70 rounded-lg text-xs text-gray-500 font-mono">
          <div className="flex items-center gap-4">
            <span>Position: ({block.bbox.l}, {block.bbox.t})</span>
            <span>Size: {block.bbox.r - block.bbox.l} × {block.bbox.b - block.bbox.t}</span>
          </div>
        </div>
      )} */}
    </div>
  );
};

export default BlockEditor; 