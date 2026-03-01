interface DiffViewerProps {
  diff: string;
}

export function DiffViewer({ diff }: DiffViewerProps) {
  const lines = diff.split('\n');

  return (
    <div style={{
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: '13px',
      lineHeight: '1.5',
      background: '#fafafa',
      borderRadius: '4px',
      border: '1px solid #e0e0e0',
      overflow: 'auto',
      maxHeight: '500px',
    }}>
      {lines.map((line, i) => {
        let bg = 'transparent';
        let color = '#333';

        if (line.startsWith('+') && !line.startsWith('+++')) {
          bg = '#e6ffec';
          color = '#1a7f37';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          bg = '#ffebe9';
          color = '#cf222e';
        } else if (line.startsWith('@@')) {
          bg = '#ddf4ff';
          color = '#0969da';
        } else if (line.startsWith('diff') || line.startsWith('---') || line.startsWith('+++')) {
          color = '#666';
        }

        return (
          <div key={i} style={{
            padding: '0 12px',
            background: bg,
            color,
            whiteSpace: 'pre',
            minHeight: '20px',
          }}>
            <span style={{ display: 'inline-block', width: '40px', color: '#999', textAlign: 'right', marginRight: '12px', userSelect: 'none' }}>
              {i + 1}
            </span>
            {line}
          </div>
        );
      })}
    </div>
  );
}
