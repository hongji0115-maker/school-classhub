'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  XCircle,
  Flame,
  Award,
  Smartphone
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Room, QuizQuestion, QuizSession, QuizParticipant, QuizAnswer } from '@/lib/types';

const KAHOOT_BUTTONS = [
  { bg: 'bg-rose-500 active:bg-rose-600', ring: 'ring-rose-300', shape: '▲' },
  { bg: 'bg-sky-500 active:bg-sky-600', ring: 'ring-sky-300', shape: '◆' },
  { bg: 'bg-amber-500 active:bg-amber-600', ring: 'ring-amber-300', shape: '●' },
  { bg: 'bg-emerald-500 active:bg-emerald-600', ring: 'ring-emerald-300', shape: '■' },
];

function QuizStudentContent() {
  const routeParams = useParams();
  const pin = (routeParams?.pin as string) || '';

  const [room, setRoom] = useState<Room | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [participant, setParticipant] = useState<QuizParticipant | null>(null);
  const [myAnswer, setMyAnswer] = useState<QuizAnswer | null>(null);

  // Join form state
  const [nickname, setNickname] = useState('');
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joinError, setJoinError] = useState('');

  // Selected Option for current question
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Initial load
  useEffect(() => {
    async function init() {
      setLoading(true);

      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('pin_code', pin)
        .single();

      if (!roomData) {
        setLoading(false);
        return;
      }
      setRoom(roomData as Room);

      const [qRes, sRes] = await Promise.all([
        supabase.from('quiz_questions').select('*').eq('room_id', roomData.id).order('order_idx'),
        supabase.from('quiz_sessions').select('*').eq('room_id', roomData.id).single(),
      ]);

      setQuestions((qRes.data || []) as QuizQuestion[]);
      setSession(sRes.data as QuizSession);

      // Check saved participant in localStorage
      if (typeof window !== 'undefined') {
        const savedNickname = localStorage.getItem(`classhub_nick_${pin}`);
        if (savedNickname) {
          const { data: pData } = await supabase
            .from('quiz_participants')
            .select('*')
            .eq('room_id', roomData.id)
            .eq('nickname', savedNickname)
            .single();

          if (pData) {
            setParticipant(pData as QuizParticipant);
          }
        }
      }

      setLoading(false);
    }

    init();
  }, [pin]);

  // Realtime Subscriptions
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`student-session-${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_sessions', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const newSession = payload.new as QuizSession;
          setSession(newSession);

          // Reset selection on new question
          if (newSession.state === 'question') {
            setSelectedOption(null);
            setMyAnswer(null);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_participants', filter: `room_id=eq.${room.id}` },
        () => {
          if (participant) {
            supabase
              .from('quiz_participants')
              .select('*')
              .eq('id', participant.id)
              .single()
              .then(({ data }) => {
                if (data) setParticipant(data as QuizParticipant);
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, participant]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = nickname.trim();
    if (!cleanNick || !room) return;

    setJoining(true);
    setJoinError('');

    try {
      // Upsert participant
      const { data, error } = await supabase
        .from('quiz_participants')
        .insert({
          room_id: room.id,
          nickname: cleanNick,
          score: 0,
          streak: 0,
        })
        .select()
        .single();

      if (error) {
        // Maybe already exists, fetch existing
        const { data: existing } = await supabase
          .from('quiz_participants')
          .select('*')
          .eq('room_id', room.id)
          .eq('nickname', cleanNick)
          .single();

        if (existing) {
          setParticipant(existing as QuizParticipant);
          if (typeof window !== 'undefined') {
            localStorage.setItem(`classhub_nick_${pin}`, cleanNick);
          }
        } else {
          setJoinError('입장 중 오류가 발생했습니다.');
        }
      } else if (data) {
        setParticipant(data as QuizParticipant);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`classhub_nick_${pin}`, cleanNick);
        }
      }
    } catch {
      setJoinError('입장 처리 중 문제가 발생했습니다.');
    } finally {
      setJoining(false);
    }
  };

  const handleAnswer = async (optionIdx: number) => {
    if (selectedOption !== null || !room || !session || !participant) return;
    const currentQ = questions[session.current_question_idx];
    if (!currentQ) return;

    setSelectedOption(optionIdx);

    const isCorrect = optionIdx === currentQ.correct_index;
    const awardedScore = isCorrect ? currentQ.points || 1000 : 0;
    const newStreak = isCorrect ? (participant.streak || 0) + 1 : 0;
    const newTotalScore = (participant.score || 0) + awardedScore;

    // Record answer
    const { data: answerData } = await supabase
      .from('quiz_answers')
      .insert({
        room_id: room.id,
        question_id: currentQ.id,
        participant_id: participant.id,
        selected_option: optionIdx,
        is_correct: isCorrect,
        score_awarded: awardedScore,
      })
      .select()
      .single();

    if (answerData) {
      setMyAnswer(answerData as QuizAnswer);
    }

    // Update participant score
    await supabase
      .from('quiz_participants')
      .update({
        score: newTotalScore,
        streak: newStreak,
        last_answered_idx: session.current_question_idx,
      })
      .eq('id', participant.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white px-4 text-center">
        <h2 className="text-xl font-bold">퀴즈 룸을 찾을 수 없습니다</h2>
        <Link href="/" className="mt-4 px-5 py-2 rounded-xl bg-indigo-600 text-sm font-bold">
          홈으로 가기
        </Link>
      </div>
    );
  }

  // SCREEN 1: NICKNAME INPUT
  if (!participant) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-6 h-6" />
          </div>

          <span className="text-xs font-mono font-bold text-slate-400">PIN: {pin}</span>
          <h1 className="text-2xl font-black text-white mt-1">{room.title}</h1>
          <p className="text-xs text-slate-400 mt-2">퀴즈에서 사용할 이름 또는 닉네임을 적어주세요</p>

          <form onSubmit={handleJoin} className="mt-6 space-y-4">
            <input
              type="text"
              required
              maxLength={12}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예: 홍길동 or 피카츄"
              className="w-full text-center text-lg font-bold py-3 px-4 rounded-2xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />

            {joinError && <p className="text-rose-400 text-xs">{joinError}</p>}

            <button
              type="submit"
              disabled={joining || !nickname.trim()}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-bold text-base hover:opacity-95 disabled:opacity-40 transition shadow-lg shadow-indigo-500/20"
            >
              {joining ? '입장하는 중...' : '퀴즈쇼 입장하기!'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const currentQ = session ? questions[session.current_question_idx] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col select-none touch-manipulation">
      {/* Top Student Bar */}
      <header className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-bold">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-slate-200">{participant.nickname}</span>
        </div>
        <div className="flex items-center gap-3">
          {participant.streak > 1 && (
            <span className="flex items-center gap-1 text-rose-400 font-extrabold">
              <Flame className="w-3.5 h-3.5 fill-rose-500" />
              <span>{participant.streak}연속!</span>
            </span>
          )}
          <span className="font-mono text-amber-400">{participant.score.toLocaleString()}점</span>
        </div>
      </header>

      {/* STATE 1: LOBBY */}
      {session?.state === 'lobby' && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-6 animate-pulse">
            <Sparkles className="w-10 h-10" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">준비 완료!</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">
            전자칠판을 바라보며 기다려주세요. 선생님이 게임을 시작하면 컨트롤러 버튼이 나타납니다!
          </p>
          <div className="mt-8 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
            PIN: {pin}
          </div>
        </main>
      )}

      {/* STATE 2: QUESTION */}
      {session?.state === 'question' && (
        <main className="flex-1 flex flex-col justify-between p-4">
          <div className="text-center py-2">
            <span className="text-xs font-bold text-indigo-400">
              문제 {session.current_question_idx + 1}
            </span>
            <p className="text-sm font-semibold text-slate-300 mt-1">
              {selectedOption === null ? '전자칠판의 문제를 보고 보기를 선택하세요!' : '답안 제출 완료!'}
            </p>
          </div>

          {/* 4 Big Touch Buttons */}
          <div className="grid grid-cols-2 gap-3 flex-1 my-2">
            {KAHOOT_BUTTONS.map((btn, idx) => {
              const isSelected = selectedOption === idx;
              const hasAnswered = selectedOption !== null;

              return (
                <button
                  key={idx}
                  disabled={hasAnswered}
                  onClick={() => handleAnswer(idx)}
                  className={`w-full h-full rounded-3xl text-white font-black text-5xl flex items-center justify-center shadow-lg transition transform active:scale-95 disabled:active:scale-100 ${
                    btn.bg
                  } ${isSelected ? 'ring-4 ring-white scale-[1.02]' : ''} ${
                    hasAnswered && !isSelected ? 'opacity-30' : 'opacity-100'
                  }`}
                >
                  {btn.shape}
                </button>
              );
            })}
          </div>

          {selectedOption !== null && (
            <div className="py-2 text-center text-xs font-bold text-slate-400 animate-pulse">
              결과 발표를 기다리는 중입니다... ⏱️
            </div>
          )}
        </main>
      )}

      {/* STATE 3: REVEALING */}
      {session?.state === 'revealing' && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          {myAnswer?.is_correct ? (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
                <CheckCircle className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-black text-emerald-400">정답입니다!</h2>
              <p className="text-lg font-bold text-white mt-2">+{myAnswer.score_awarded}점 획득</p>
              {participant.streak > 1 && (
                <span className="mt-4 px-4 py-1.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-black flex items-center gap-1.5">
                  <Flame className="w-4 h-4 fill-rose-500" />
                  <span>{participant.streak}연속 정답 진행 중!</span>
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-400 mb-4">
                <XCircle className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-black text-rose-400">아쉬워요!</h2>
              <p className="text-sm text-slate-400 mt-2">다음 문제에서 역전을 노려보세요!</p>
            </div>
          )}
        </main>
      )}

      {/* STATE 4: LEADERBOARD */}
      {session?.state === 'leaderboard' && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4">
            <Award className="w-8 h-8" />
          </div>
          <span className="text-xs uppercase font-bold text-slate-400">내 현재 누적 점수</span>
          <div className="text-4xl font-mono font-black text-amber-400 mt-1">
            {participant.score.toLocaleString()}점
          </div>
          <p className="text-xs text-slate-400 mt-4">
            전자칠판의 순위표를 확인하세요!
          </p>
        </main>
      )}

      {/* STATE 5: FINISHED */}
      {session?.state === 'finished' && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-3xl font-black text-amber-300">수고하셨습니다! 👏</h2>
          <p className="text-sm text-slate-400 mt-2">모든 퀴즈가 종료되었습니다.</p>
          <div className="mt-6 p-6 rounded-3xl bg-slate-900 border border-slate-800 w-full max-w-xs">
            <span className="text-xs text-slate-400">최종 점수</span>
            <div className="text-3xl font-mono font-black text-white mt-1">
              {participant.score.toLocaleString()}점
            </div>
          </div>
          <Link
            href="/"
            className="mt-8 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
          >
            홈으로 나가기
          </Link>
        </main>
      )}
    </div>
  );
}

export default function QuizStudentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
          <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <QuizStudentContent />
    </Suspense>
  );
}
