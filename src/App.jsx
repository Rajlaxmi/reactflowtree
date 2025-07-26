import { useState, useCallback, useEffect } from 'react';
import { ReactFlow, applyNodeChanges, applyEdgeChanges, addEdge, Background, Controls, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import yaml from 'js-yaml';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

// Custom Node Component with side handles
const CustomNode = ({ data }) => {
  return (
    <div style={{
      backgroundColor: '#1c1b1a',
      border: '1px solid #374151',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: 'normal',
      color: '#f9fafb',
      padding: '30px',
      paddingBottom: '30px',
      width: '320px',
      minHeight: '200px',
      textAlign: 'left',
      lineHeight: '1.6',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      position: 'relative',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Source handle on the right side */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#555',
          border: '1px solid #666',
          width: 2,
          height: 2,
        }}
      />
      
      {/* Target handle on the left side */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#555',
          border: '1px solid #666',
          width: 2,
          height: 2,
        }}
      />
      
      <ReactMarkdown 
        rehypePlugins={[rehypeRaw]}
        components={{
          p: ({ children }) => <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.6' }}>{children}</p>,
          h1: ({ children }) => <h1 style={{ fontSize: '20px', margin: '0 0 16px 0', fontWeight: '600', color: '#f9fafb' }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: '18px', margin: '0 0 12px 0', fontWeight: '600', color: '#f9fafb' }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', fontWeight: '600', color: '#f9fafb' }}>{children}</h3>,
          h4: ({ children }) => <h4 style={{ fontSize: '14px', margin: '0 0 8px 0', fontWeight: '600', color: '#f9fafb' }}>{children}</h4>,
          ul: ({ children }) => <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', listStyle: 'disc' }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: '0 0 16px 0', paddingLeft: '20px', listStyle: 'decimal' }}>{children}</ol>,
          li: ({ children }) => <li style={{ margin: '0 0 4px 0', lineHeight: '1.6' }}>{children}</li>,
          strong: ({ children }) => <strong style={{ fontWeight: '600', color: '#f9fafb' }}>{children}</strong>,
          em: ({ children }) => <em style={{ fontStyle: 'italic', color: '#d1d5db' }}>{children}</em>,
          code: ({ children }) => <code style={{ backgroundColor: '#374151', padding: '2px 6px', borderRadius: '4px', fontSize: '13px' }}>{children}</code>,
        }}
      >
        {data.label}
      </ReactMarkdown>
    </div>
  );
};

// Node types configuration
const nodeTypes = {
  customNode: CustomNode,
};
 
// Function to create horizontal layout (modified from vertical)
const createHorizontalLayout = (nodes, edges) => {
  const nodeMap = new Map();
  const children = new Map();
  const visited = new Set();
  
  // Create node map and initialize children map
  nodes.forEach(node => {
    nodeMap.set(node.id, node);
    children.set(node.id, []);
  });
  
  // Build parent-child relationships
  edges.forEach(edge => {
    const parentChildren = children.get(edge.source) || [];
    parentChildren.push(edge.target);
    children.set(edge.source, parentChildren);
  });
  
  // Find root node (node with no incoming edges)
  const targetNodes = new Set(edges.map(edge => edge.target));
  const rootNode = nodes.find(node => !targetNodes.has(node.id));
  
  const positionedNodes = [];
  const HORIZONTAL_SPACING = 500; // Horizontal spacing between levels
  const VERTICAL_SPACING = 450;   // Vertical spacing between siblings
  
  // Recursive function to position nodes horizontally
  const positionNode = (nodeId, x, y, level = 0) => {
    if (visited.has(nodeId)) return y;
    
    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    
    // Position current node
    positionedNodes.push({
      ...node,
      position: { x, y }
    });
    
    // Get children of current node
    const nodeChildren = children.get(nodeId) || [];
    
    if (nodeChildren.length === 0) {
      return y + VERTICAL_SPACING;
    }
    
    // Position children horizontally to the right of parent
    let currentY = y;
    let maxY = currentY;
    
    // If multiple children, spread them vertically
    const startY = y - ((nodeChildren.length - 1) * VERTICAL_SPACING) / 2;
    
    nodeChildren.forEach((childId, index) => {
      const childY = startY + (index * VERTICAL_SPACING);
      const childX = x + HORIZONTAL_SPACING;
      const nextY = positionNode(childId, childX, childY, level + 1);
      maxY = Math.max(maxY, nextY);
    });
    
    return maxY;
  };
  
  // Start positioning from root
  if (rootNode) {
    positionNode(rootNode.id, 50, 300); // Start more to the left for horizontal layout
  }
  
  return positionedNodes;
};

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [focusedNode, setFocusedNode] = useState(null);

  // Load graph data from YAML file
  useEffect(() => {
    const loadGraphData = async () => {
      try {
        const response = await fetch('/graph-data.yaml');
        const yamlText = await response.text();
        const data = yaml.load(yamlText);
        
        // Convert YAML nodes to ReactFlow format with custom node type
        const processedNodes = data.nodes.map(node => ({
          id: node.id,
          type: 'customNode', // Use our custom node type
          data: { label: node.label },
          // Position will be set by the layout function
        }));
        
        // Convert YAML edges to ReactFlow format
        const processedEdges = data.edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: null, // Use default source handle
          targetHandle: null, // Use default target handle
          style: { stroke: '#666', strokeWidth: 1 }
        }));
        
        // Apply automatic horizontal layout
        const layoutedNodes = createHorizontalLayout(processedNodes, processedEdges);
        
        setNodes(layoutedNodes);
        setEdges(processedEdges);
        setLoading(false);
      } catch (error) {
        console.error('Error loading graph data:', error);
        setLoading(false);
      }
    };

    loadGraphData();
  }, []);
 
  const onNodesChange = useCallback(
    (changes) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  const onNodeClick = useCallback((event, node) => {
    setFocusedNode(node);
  }, []);

  const closeFocusMode = useCallback(() => {
    setFocusedNode(null);
  }, []);

  // Handle escape key to close focus mode
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && focusedNode) {
        closeFocusMode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedNode, closeFocusMode]);

  if (loading) {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontSize: '18px',
        backgroundColor: '#1a1a1a',
        color: '#e0e0e0'
      }}>
        Loading graph data...
      </div>
    );
  }
 
  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#1a1a1a' }}>
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        zIndex: 10,
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#e0e0e0'
      }}>
        Maniac by Benjamin Labatut
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        defaultViewport={{ x: 200, y: 70, zoom: 0.8 }}
        style={{ backgroundColor: '#1a1a1a' }}
      >
        <Background 
          color="#333" 
          variant="dots"
          gap={25}
          size={2}
        />
        <Controls style={{ backgroundColor: '#2a2a2a', border: '1px solid #444' }} />
      </ReactFlow>
      
      {/* Focus Mode Modal */}
      {focusedNode && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}
          onClick={closeFocusMode}
        >
          <div 
            style={{
              backgroundColor: '#1c1b1a',
              border: '1px solid #374151',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: '40px',
              color: '#f9fafb',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeFocusMode}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.color = '#f9fafb'}
              onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
            >
              ×
            </button>
            
            {/* Node content */}
            <div style={{ paddingRight: '40px' }}>
              <ReactMarkdown 
                rehypePlugins={[rehypeRaw]}
                components={{
                  p: ({ children }) => <p style={{ margin: '0 0 20px 0', fontSize: '16px', lineHeight: '1.7' }}>{children}</p>,
                  h1: ({ children }) => <h1 style={{ fontSize: '28px', margin: '0 0 24px 0', fontWeight: '600', color: '#f9fafb' }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: '24px', margin: '0 0 20px 0', fontWeight: '600', color: '#f9fafb' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: '20px', margin: '0 0 16px 0', fontWeight: '600', color: '#f9fafb' }}>{children}</h3>,
                  h4: ({ children }) => <h4 style={{ fontSize: '18px', margin: '0 0 12px 0', fontWeight: '600', color: '#f9fafb' }}>{children}</h4>,
                  ul: ({ children }) => <ul style={{ margin: '0 0 20px 0', paddingLeft: '24px', listStyle: 'disc' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ margin: '0 0 20px 0', paddingLeft: '24px', listStyle: 'decimal' }}>{children}</ol>,
                  li: ({ children }) => <li style={{ margin: '0 0 8px 0', lineHeight: '1.7' }}>{children}</li>,
                  strong: ({ children }) => <strong style={{ fontWeight: '600', color: '#f9fafb' }}>{children}</strong>,
                  em: ({ children }) => <em style={{ fontStyle: 'italic', color: '#d1d5db' }}>{children}</em>,
                  code: ({ children }) => <code style={{ backgroundColor: '#374151', padding: '4px 8px', borderRadius: '6px', fontSize: '15px' }}>{children}</code>,
                  blockquote: ({ children }) => <blockquote style={{ borderLeft: '4px solid #374151', paddingLeft: '16px', margin: '0 0 20px 0', fontStyle: 'italic', color: '#d1d5db' }}>{children}</blockquote>,
                }}
              >
                {focusedNode.data.label}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App
