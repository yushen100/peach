import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { InputBase, TextField } from '@/components/base/input/input';
import { spriteGlyph } from '../components/sprite-glyph';
import { composingKey } from '../components/ime';

const SearchGlyph = spriteGlyph('search');

/* 只读筛选不配提交按钮：停手 300ms 就查，回车是「别等了，现在就查」。中文输入法选字过程中
   一样发 input，拿还没定型的拼音去筛，筛的是「zhon」这种半截输入；组完字由 compositionend
   接手，组字过程中的回车是在定字，也放过去。 */
export function IndexSearch({ label, value, onQuery, placeholder }: { label: string; value: string; onQuery(q: string): void; placeholder?: string }) {
  const [text, setText] = useState(value);
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { clearTimeout(timer.current); setText(value) }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const later = (next: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onQuery(next.trim()), 300);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || composing.current || composingKey(event.nativeEvent)) return;
    event.preventDefault();
    clearTimeout(timer.current);
    onQuery(text.trim());
  };
  return (
    <div data-index-search="" className="ml-auto min-w-0 max-w-80 flex-1"
      onCompositionStart={() => { composing.current = true }}
      onCompositionEnd={(event) => { composing.current = false; later((event.target as HTMLInputElement).value) }}>
      <TextField aria-label={label} value={text}
        onChange={(next) => { setText(next); if (!composing.current) later(next) }}>
        <InputBase type="search" leadingIcon={SearchGlyph} spellCheck={false} autoComplete="off" enterKeyHint="search"
          placeholder={placeholder}
          onKeyDown={onKeyDown} />
      </TextField>
    </div>
  );
}

