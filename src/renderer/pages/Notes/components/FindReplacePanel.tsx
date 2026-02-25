import { Input, Button } from '@arco-design/web-react';
import { IconSearch } from '@arco-design/web-react/icon';

interface FindReplacePanelProps {
  findText: string;
  replaceText: string;
  showReplaceBar: boolean;
  findCaseSensitive: boolean;
  findWholeWord: boolean;
  findRegex: boolean;
  findStatusText: string;
  hasFindError: boolean;
  onFindTextChange: (value: string) => void;
  onReplaceTextChange: (value: string) => void;
  onFindPrev: () => void;
  onFindNext: () => void;
  onToggleReplaceBar: () => void;
  onClose: () => void;
  onToggleCaseSensitive: () => void;
  onToggleWholeWord: () => void;
  onToggleRegex: () => void;
  onReplaceCurrent: () => void;
  onReplaceAll: () => void;
}

function FindReplacePanel({
  findText,
  replaceText,
  showReplaceBar,
  findCaseSensitive,
  findWholeWord,
  findRegex,
  findStatusText,
  hasFindError,
  onFindTextChange,
  onReplaceTextChange,
  onFindPrev,
  onFindNext,
  onToggleReplaceBar,
  onClose,
  onToggleCaseSensitive,
  onToggleWholeWord,
  onToggleRegex,
  onReplaceCurrent,
  onReplaceAll,
}: FindReplacePanelProps) {
  return (
    <div className="notes-find-panel">
      <div className="notes-find-row">
        <Input
          placeholder="查找..."
          value={findText}
          onChange={onFindTextChange}
          allowClear
          prefix={<IconSearch />}
        />
        <span className={`notes-find-count ${hasFindError ? 'error' : ''}`}>{findStatusText}</span>
        <Button size="small" onClick={onFindPrev}>
          上一个
        </Button>
        <Button size="small" onClick={onFindNext}>
          下一个
        </Button>
        <Button size="small" onClick={onToggleReplaceBar}>
          替换
        </Button>
        <Button size="small" onClick={onClose}>
          关闭
        </Button>
      </div>
      <div className="notes-find-options">
        <Button
          size="mini"
          type={findCaseSensitive ? 'primary' : 'outline'}
          onClick={onToggleCaseSensitive}
        >
          Aa
        </Button>
        <Button size="mini" type={findWholeWord ? 'primary' : 'outline'} onClick={onToggleWholeWord}>
          单词
        </Button>
        <Button size="mini" type={findRegex ? 'primary' : 'outline'} onClick={onToggleRegex}>
          正则
        </Button>
      </div>
      {showReplaceBar && (
        <div className="notes-find-row">
          <Input placeholder="替换为..." value={replaceText} onChange={onReplaceTextChange} allowClear />
          <Button size="small" type="primary" onClick={onReplaceCurrent}>
            替换当前
          </Button>
          <Button size="small" onClick={onReplaceAll}>
            全部替换
          </Button>
        </div>
      )}
    </div>
  );
}

export default FindReplacePanel;
