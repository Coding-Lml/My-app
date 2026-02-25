import { Button, Card, Empty } from '@arco-design/web-react';
import { IconCopy } from '@arco-design/web-react/icon';

interface RunOutputCardProps {
  output: string;
  executionTime: number;
  onCopy: () => void;
}

function RunOutputCard({ output, executionTime, onCopy }: RunOutputCardProps) {
  return (
    <Card
      title={
        <div className="output-header">
          <span>运行输出</span>
          {executionTime > 0 ? <span className="execution-time">{executionTime}ms</span> : null}
        </div>
      }
      className="output-card"
      extra={
        output ? (
          <Button type="text" size="small" icon={<IconCopy />} onClick={onCopy}>
            复制
          </Button>
        ) : null
      }
      bodyStyle={{ padding: 0 }}
    >
      <div className={`output-content ${output ? '' : 'empty'}`}>
        {output ? <pre>{output}</pre> : <Empty description="运行后输出会显示在这里" style={{ margin: 0 }} />}
      </div>
    </Card>
  );
}

export default RunOutputCard;
