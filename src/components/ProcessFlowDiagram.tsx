import React from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';

const nodes = [
  { id: '1', data: { label: 'Enterprise PTP Calculators' }, position: { x: 0, y: 100 } },
  { id: '2', data: { label: 'Creator PTP Calculator' }, position: { x: 0, y: 250 } },
  { id: '3', data: { label: 'MoneyBooker' }, position: { x: 300, y: 175 } },
  { id: '4', data: { label: 'PSL' }, position: { x: 600, y: 175 } },
  { id: '5', data: { label: 'Netsuite' }, position: { x: 900, y: 175 } },
  { id: '6', data: { label: 'CORE DATA' }, position: { x: 300, y: 0 } },
];

const edges = [
  { id: 'e1-3', source: '1', target: '3', animated: true },
  { id: 'e2-3', source: '2', target: '3', animated: true },
  { id: 'e3-4', source: '3', target: '4', animated: true },
  { id: 'e3-5', source: '3', target: '5', animated: true, label: 'NSGW' },
  { id: 'e4-5', source: '4', target: '5', animated: true, label: 'NSGW' },
  { id: 'e6-3', source: '6', target: '3', animated: true },
];

const ProcessFlowDiagram = () => (
  <div style={{ height: 400, width: '100%', background: '#f6f8fa', borderRadius: 8 }}>
    <ReactFlow nodes={nodes} edges={edges} fitView>
      <MiniMap />
      <Controls />
      <Background color="#aaa" gap={16} />
    </ReactFlow>
  </div>
);

export default ProcessFlowDiagram; 