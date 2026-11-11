'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Sparkles, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function CreateBoardPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columns, setColumns] = useState<string[]>(['모둠 1', '모둠 2', '모둠 3']);
  const [newColName, setNewColName] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newColName.trim();
    if (clean && !columns.includes(clean)) {
      setColumns([...columns, clean]);
      setNewColName('');
    }
  };

  const handleRemoveColumn = (idx: number) => {
    if (columns.length > 1) {
      setColumns(columns.filter((_, i) => i !== idx));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('보드 제목을 입력해주세요.');
      return;
    }

    setCreating(true);
    setErrorMsg('');

    // Generate random 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert({
          pin_code: pin,
          title: title.trim(),
          description: description.trim(),
          room_type: 'board',
          status: 'active',
          settings: { columns },
        })
        .select()
        .single();

      if (error || !data) {
        setErrorMsg('보드 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
        setCreating(false);
        return;
      }

      router.push(`/board?pin=${pin}`);
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다.');
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>홈으로</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <MessageSquare className="w-4 h-4" />
            </span>
            <span className="text-sm font-extrabold text-slate-800">새 패들렛 협업 보드 생성</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                보드 제목 *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 4월 학급 회의 & 건의사항 나눔터"
                className="w-full text-base font-bold py-3 px-4 rounded-xl border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                설명 및 안내 사항 (선택)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="예: 자유롭게 의견을 적고, 마음에 드는 의견에 하트를 눌러주세요."
                className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:border-indigo-600 focus:outline-none resize-none"
              />
            </div>

            {/* Columns Configuration */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                모둠 / 컬럼 구성 (최소 1개)
              </label>
              <p className="text-xs text-slate-500 mb-3">
                학생들이 글을 분류하여 남길 수 있는 컬럼(모둠, 주제)을 설정하세요.
              </p>

              <div className="flex flex-wrap gap-2 mb-3">
                {columns.map((col, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800"
                  >
                    <span>{col}</span>
                    {columns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(idx)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="새 컬럼 이름 (예: 질문방)"
                  className="flex-1 text-xs py-2 px-3 rounded-xl border border-slate-300 focus:border-indigo-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition"
                >
                  + 추가
                </button>
              </div>
            </div>

            {errorMsg && <p className="text-rose-500 text-xs font-semibold">{errorMsg}</p>}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md shadow-amber-200 disabled:opacity-50 transition"
              >
                {creating ? '보드 생성 중...' : '보드 생성하기'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
