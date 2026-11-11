'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, HelpCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface QuestionDraft {
  question_text: string;
  options: [string, string, string, string];
  correct_index: number;
  time_limit_sec: number;
  explanation: string;
}

export default function CreateQuizPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    {
      question_text: '',
      options: ['', '', '', ''],
      correct_index: 0,
      time_limit_sec: 15,
      explanation: '',
    },
  ]);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: '',
        options: ['', '', '', ''],
        correct_index: 0,
        time_limit_sec: 15,
        explanation: '',
      },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== idx));
    }
  };

  const handleUpdateQuestion = (idx: number, updated: Partial<QuestionDraft>) => {
    setQuestions(
      questions.map((q, i) => (i === idx ? { ...q, ...updated } : q))
    );
  };

  const handleUpdateOption = (qIdx: number, optIdx: number, val: string) => {
    const q = questions[qIdx];
    const newOpts = [...q.options] as [string, string, string, string];
    newOpts[optIdx] = val;
    handleUpdateQuestion(qIdx, { options: newOpts });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('퀴즈 제목을 입력해주세요.');
      return;
    }

    // Validation
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setErrorMsg(`문제 ${i + 1}번의 문제 내용을 입력해주세요.`);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!q.options[j].trim()) {
          setErrorMsg(`문제 ${i + 1}번의 보기 ${j + 1}번 내용을 입력해주세요.`);
          return;
        }
      }
    }

    setCreating(true);
    setErrorMsg('');

    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      // 1. Create Room
      const { data: room, error: rErr } = await supabase
        .from('rooms')
        .insert({
          pin_code: pin,
          title: title.trim(),
          description: description.trim(),
          room_type: 'quiz',
          status: 'active',
          settings: { bgm: true },
        })
        .select()
        .single();

      if (rErr || !room) {
        setErrorMsg('퀴즈 룸 생성 중 오류가 발생했습니다.');
        setCreating(false);
        return;
      }

      // 2. Insert Questions
      const qInserts = questions.map((q, idx) => ({
        room_id: room.id,
        question_text: q.question_text.trim(),
        options: q.options.map((opt) => opt.trim()),
        correct_index: q.correct_index,
        time_limit_sec: q.time_limit_sec,
        points: 1000,
        order_idx: idx,
        explanation: q.explanation.trim(),
      }));

      await supabase.from('quiz_questions').insert(qInserts);

      // 3. Insert Quiz Session
      await supabase.from('quiz_sessions').insert({
        room_id: room.id,
        current_question_idx: -1,
        state: 'lobby',
      });

      router.push(`/quiz/teacher/${pin}`);
    } catch {
      setErrorMsg('네트워크 통신 중 오류가 발생했습니다.');
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>홈으로</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-violet-100 text-violet-700">
              <HelpCircle className="w-4 h-4" />
            </span>
            <span className="text-sm font-extrabold text-slate-800">새 실시간 퀴즈쇼 생성</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <form onSubmit={handleCreate} className="space-y-6">
          {/* Room Basic Info */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">1. 퀴즈 기본 정보</h2>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                퀴즈 제목 *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 5학년 1학기 사회 단원평가 퀴즈"
                className="w-full text-base font-bold py-2.5 px-3.5 rounded-xl border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                설명 (선택)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="예: 오늘 배운 내용을 복습하는 스피드 퀴즈입니다."
                className="w-full text-xs py-2 px-3 rounded-xl border border-slate-300 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Questions Builder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-bold text-slate-900">
                2. 문제 구성 ({questions.length}문항)
              </h2>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 text-white font-bold text-xs hover:bg-violet-700 shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>문제 추가</span>
              </button>
            </div>

            {questions.map((q, qIdx) => (
              <div
                key={qIdx}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-800 text-xs font-extrabold">
                    문제 {qIdx + 1}
                  </span>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <span>제한 시간:</span>
                      <select
                        value={q.time_limit_sec}
                        onChange={(e) =>
                          handleUpdateQuestion(qIdx, { time_limit_sec: Number(e.target.value) })
                        }
                        className="py-1 px-2 rounded-lg border border-slate-300 text-xs font-bold"
                      >
                        <option value={10}>10초</option>
                        <option value={15}>15초</option>
                        <option value={20}>20초</option>
                        <option value={30}>30초</option>
                      </select>
                    </div>

                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIdx)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title="이 문제 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <div>
                  <input
                    type="text"
                    required
                    value={q.question_text}
                    onChange={(e) =>
                      handleUpdateQuestion(qIdx, { question_text: e.target.value })
                    }
                    placeholder="문제 내용을 입력하세요 (예: 조선을 건국한 인물은?)"
                    className="w-full text-sm font-bold py-2.5 px-3.5 rounded-xl border border-slate-300 focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                {/* 4 Options */}
                <div className="space-y-2 pt-2">
                  <p className="text-[11px] font-bold text-slate-500">
                    보기 입력 및 정답 라디오 버튼 선택:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map((optIdx) => {
                      const isCorrect = q.correct_index === optIdx;
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-2 p-2 rounded-xl border transition ${
                            isCorrect ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`correct-${qIdx}`}
                            checked={isCorrect}
                            onChange={() => handleUpdateQuestion(qIdx, { correct_index: optIdx })}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                          />
                          <input
                            type="text"
                            required
                            value={q.options[optIdx]}
                            onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                            placeholder={`보기 ${optIdx + 1}`}
                            className="flex-1 text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 focus:border-indigo-600 focus:outline-none bg-white"
                          />
                          {isCorrect && (
                            <span className="text-[10px] font-extrabold text-emerald-700 pr-1">
                              정답
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <input
                    type="text"
                    value={q.explanation}
                    onChange={(e) =>
                      handleUpdateQuestion(qIdx, { explanation: e.target.value })
                    }
                    placeholder="정답 공개 시 표시할 해설 (선택)"
                    className="w-full text-xs py-1.5 px-3 rounded-lg border border-slate-200 text-slate-600 focus:outline-none"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddQuestion}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-300 text-slate-600 font-bold text-xs hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/50 transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ 새 문제 추가하기</span>
            </button>
          </div>

          {errorMsg && <p className="text-rose-500 text-xs font-semibold">{errorMsg}</p>}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={creating}
              className="px-7 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md shadow-violet-200 disabled:opacity-50 transition"
            >
              {creating ? '퀴즈 생성 중...' : '퀴즈 생성하고 대기실 열기'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
