'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Play,
  Clock,
  Award,
  ChevronRight,
  RotateCcw,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Flame,
  Volume2,
  VolumeX,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '@/lib/supabase';
import { Room, QuizQuestion, QuizSession, QuizParticipant, QuizAnswer } from '@/lib/types';

const KAHOOT_COLORS = [
  { bg: 'bg-rose-500', hover: 'hover:bg-rose-600', shape: '▲', label: '빨강 (삼각형)' },
  { bg: 'bg-sky-500', hover: 'hover:bg-sky-600', shape: '◆', label: '파랑 (다이아몬드)' },
  { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', shape: '●', label: '노랑 (원)' },
  { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-600', shape: '■', label: '초록 (사각형)' },
];

function QuizTeacherContent() {
  const routeParams = useParams();
  const pin = (routeParams?.pin as string) || '';

  const [room, setRoom] = useState<Room | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [participants, setParticipants] = useState<QuizParticipant[]>([]);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  // Timer
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Audio effects synthesizer using Web Audio API (No external assets required!)
  const playTone = (type: 'tick' | 'start' | 'correct' | 'win') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'tick') {
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      } else if (type === 'start') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'correct') {
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else if (type === 'win') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
      }
    } catch {
      // AudioContext muted or not allowed
    }
  };

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

      const [qRes, sRes, pRes] = await Promise.all([
        supabase.from('quiz_questions').select('*').eq('room_id', roomData.id).order('order_idx'),
        supabase.from('quiz_sessions').select('*').eq('room_id', roomData.id).single(),
        supabase.from('quiz_participants').select('*').eq('room_id', roomData.id).order('score', { ascending: false }),
      ]);

      setQuestions((qRes.data || []) as QuizQuestion[]);
      setSession(sRes.data as QuizSession);
      setParticipants((pRes.data || []) as QuizParticipant[]);
      setLoading(false);
    }

    init();
  }, [pin]);

  // Realtime Subscriptions
  useEffect(() => {
    if (!room) return;

    // Session channel
    const sessionChannel = supabase
      .channel(`quiz-session-${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_sessions', filter: `room_id=eq.${room.id}` },
        (payload) => {
          setSession(payload.new as QuizSession);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_participants', filter: `room_id=eq.${room.id}` },
        () => {
          // Refresh participants on change
          supabase
            .from('quiz_participants')
            .select('*')
            .eq('room_id', room.id)
            .order('score', { ascending: false })
            .then(({ data }) => setParticipants((data || []) as QuizParticipant[]));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_answers', filter: `room_id=eq.${room.id}` },
        () => {
          // Refresh answers for current question
          supabase
            .from('quiz_answers')
            .select('*')
            .eq('room_id', room.id)
            .then(({ data }) => setAnswers((data || []) as QuizAnswer[]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
  }, [room]);

  // Timer logic for 'question' state
  useEffect(() => {
    if (session?.state === 'question' && questions[session.current_question_idx]) {
      const currentQ = questions[session.current_question_idx];
      setTimeLeft(currentQ.time_limit_sec || 15);
      playTone('start');

      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimeOver();
            return 0;
          }
          if (prev <= 5) playTone('tick');
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.state, session?.current_question_idx]);

  // Confetti when finished
  useEffect(() => {
    if (session?.state === 'finished') {
      playTone('win');
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    }
  }, [session?.state]);

  const handleTimeOver = async () => {
    if (!room) return;
    playTone('correct');
    await supabase
      .from('quiz_sessions')
      .update({ state: 'revealing', updated_at: new Date().toISOString() })
      .eq('room_id', room.id);
  };

  const handleStartGame = async () => {
    if (!room) return;
    // Reset answers
    await supabase.from('quiz_answers').delete().eq('room_id', room.id);
    // Reset participants score
    await supabase.from('quiz_participants').update({ score: 0, streak: 0 }).eq('room_id', room.id);

    await supabase
      .from('quiz_sessions')
      .update({
        current_question_idx: 0,
        state: 'question',
        question_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', room.id);
  };

  const handleShowLeaderboard = async () => {
    if (!room) return;
    await supabase
      .from('quiz_sessions')
      .update({ state: 'leaderboard', updated_at: new Date().toISOString() })
      .eq('room_id', room.id);
  };

  const handleNextQuestion = async () => {
    if (!room || !session) return;
    const nextIdx = session.current_question_idx + 1;

    if (nextIdx < questions.length) {
      await supabase
        .from('quiz_sessions')
        .update({
          current_question_idx: nextIdx,
          state: 'question',
          question_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', room.id);
    } else {
      await supabase
        .from('quiz_sessions')
        .update({
          state: 'finished',
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', room.id);
    }
  };

  const handleRestartLobby = async () => {
    if (!room) return;
    await supabase
      .from('quiz_sessions')
      .update({
        current_question_idx: -1,
        state: 'lobby',
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', room.id);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  if (loading || !room || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="font-bold text-slate-300">퀴즈 룸 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const currentQ = questions[session.current_question_idx] || questions[0];
  const qAnswers = answers.filter((a) => a.question_id === currentQ?.id);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Top Navbar */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-lg text-white">{room.title}</h1>
            <span className="text-xs text-indigo-400 font-semibold">선생님 전자칠판 화면</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
            title={soundEnabled ? '효과음 끄기' : '효과음 켜기'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
            title="전체화면"
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Reset to Lobby */}
          {session.state !== 'lobby' && (
            <button
              onClick={handleRestartLobby}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>대기실로</span>
            </button>
          )}
        </div>
      </header>

      {/* STAGE 1: LOBBY */}
      {session.state === 'lobby' && (
        <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 flex flex-col items-center justify-between text-center">
          <div className="w-full">
            <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-extrabold uppercase tracking-widest mb-4">
              ClassLive 퀴즈 대기실
            </span>
            <h2 className="text-3xl sm:text-4xl font-black">학생들은 휴대폰으로 참가하세요!</h2>
            <p className="text-slate-400 text-sm mt-2">
              브라우저에서 <span className="text-indigo-400 font-bold">ClassHub</span> 접속 후 아래 PIN을 입력하세요
            </p>

            {/* Giant PIN Display */}
            <div className="mt-8 inline-block bg-gradient-to-br from-indigo-900/60 to-slate-900 border-2 border-indigo-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-500/20">
              <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">참가 PIN 번호</span>
              <div className="mt-2 text-6xl sm:text-7xl font-mono font-black tracking-[0.3em] text-white">
                {room.pin_code}
              </div>
            </div>
          </div>

          {/* Joined Participants Grid */}
          <div className="my-8 w-full max-w-4xl bg-slate-900/50 rounded-3xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>참가자 ({participants.length}명)</span>
              </div>
              <span className="text-xs text-slate-500">실시간 자동 입장 중...</span>
            </div>

            {participants.length === 0 ? (
              <div className="py-12 text-slate-500 text-sm animate-pulse">
                학생들이 입장하기를 기다리는 중입니다... 📱
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5 justify-center max-h-48 overflow-y-auto p-2">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-950/80 border border-indigo-500/30 text-white font-bold text-sm shadow-sm animate-fade-in"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>{p.nickname}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Start Game Button */}
          <div className="w-full max-w-md">
            <button
              onClick={handleStartGame}
              disabled={participants.length === 0}
              className="w-full flex items-center justify-center gap-3 py-4 px-8 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-black text-lg hover:opacity-95 disabled:opacity-40 transition shadow-xl shadow-purple-500/30"
            >
              <Play className="w-6 h-6 fill-white" />
              <span>{participants.length === 0 ? '학생 참가 대기 중...' : '게임 시작하기!'}</span>
            </button>
          </div>
        </main>
      )}

      {/* STAGE 2: QUESTION & STAGE 3: REVEALING */}
      {(session.state === 'question' || session.state === 'revealing') && currentQ && (
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6 flex flex-col justify-between">
          {/* Question Header & Timer Bar */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="px-3.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-extrabold text-xs">
                문제 {session.current_question_idx + 1} / {questions.length}
              </span>

              {/* Timer Pill */}
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-700">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className={`font-mono font-black text-lg ${timeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
                  {timeLeft}초
                </span>
              </div>

              {/* Submitted Count */}
              <div className="text-xs font-bold text-slate-400">
                답안 제출: <span className="text-white font-mono text-sm">{qAnswers.length}</span> / {participants.length}명
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl text-center min-h-[140px] flex items-center justify-center">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-snug">
                {currentQ.question_text}
              </h2>
            </div>
          </div>

          {/* 4 Options Grid (Kahoot Signature Look) */}
          <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {currentQ.options.map((optText, idx) => {
              const kColor = KAHOOT_COLORS[idx] || KAHOOT_COLORS[0];
              const isCorrect = idx === currentQ.correct_index;
              const isRevealing = session.state === 'revealing';
              const optionVotes = qAnswers.filter((a) => a.selected_option === idx).length;
              const votePct = qAnswers.length > 0 ? Math.round((optionVotes / qAnswers.length) * 100) : 0;

              return (
                <div
                  key={idx}
                  className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white font-bold flex items-center justify-between shadow-lg transition-all ${
                    kColor.bg
                  } ${isRevealing && !isCorrect ? 'opacity-30 grayscale' : 'opacity-100'} ${
                    isRevealing && isCorrect ? 'ring-4 ring-emerald-400 scale-[1.02]' : ''
                  }`}
                >
                  <div className="flex items-center gap-4 z-10">
                    <span className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center font-black text-xl">
                      {kColor.shape}
                    </span>
                    <span className="text-lg sm:text-xl font-bold">{optText}</span>
                  </div>

                  {/* Vote Count & Correct Badge */}
                  {isRevealing && (
                    <div className="flex items-center gap-3 z-10">
                      <span className="text-sm font-mono font-extrabold bg-black/30 px-3 py-1 rounded-lg">
                        {optionVotes}표 ({votePct}%)
                      </span>
                      {isCorrect && (
                        <CheckCircle2 className="w-8 h-8 text-white drop-shadow-md" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanation & Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-left">
              {session.state === 'revealing' && currentQ.explanation && (
                <div className="px-4 py-2.5 rounded-xl bg-indigo-950/70 border border-indigo-500/30 text-xs sm:text-sm text-indigo-200">
                  💡 <span className="font-bold">해설:</span> {currentQ.explanation}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {session.state === 'question' ? (
                <button
                  onClick={handleTimeOver}
                  className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition"
                >
                  시간 종료 (정답 확인)
                </button>
              ) : (
                <button
                  onClick={handleShowLeaderboard}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base shadow-lg shadow-indigo-600/30 transition"
                >
                  <span>순위표 보기</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </main>
      )}

      {/* STAGE 4: LEADERBOARD */}
      {session.state === 'leaderboard' && (
        <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col justify-between text-center">
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-xs uppercase tracking-wider mb-2">
              실시간 순위표
            </span>
            <h2 className="text-3xl sm:text-4xl font-black">명예의 전당 TOP 5</h2>
          </div>

          {/* Leaderboard Cards */}
          <div className="my-8 flex flex-col gap-3">
            {participants.slice(0, 5).map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  idx === 0
                    ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base ${
                      idx === 0
                        ? 'bg-amber-400 text-slate-950 shadow-md'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-950'
                        : idx === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-lg font-bold text-white">{p.nickname}</span>
                  {p.streak > 1 && (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      <Flame className="w-3 h-3 fill-rose-500" />
                      <span>{p.streak}연속 정답!</span>
                    </span>
                  )}
                </div>

                <div className="font-mono font-black text-xl text-amber-400">
                  {p.score.toLocaleString()} <span className="text-xs text-slate-400 font-normal">점</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <button
              onClick={handleNextQuestion}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 text-white font-black text-lg hover:opacity-95 shadow-xl shadow-indigo-600/30 transition inline-flex items-center gap-2"
            >
              <span>{session.current_question_idx + 1 < questions.length ? '다음 문제로 ▶' : '최종 결과 발표 🏆'}</span>
            </button>
          </div>
        </main>
      )}

      {/* STAGE 5: FINISHED (PODIUM) */}
      {session.state === 'finished' && (
        <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 flex flex-col items-center justify-between text-center">
          <div>
            <Award className="w-16 h-16 text-amber-400 mx-auto mb-3 animate-bounce" />
            <h2 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-200 bg-clip-text text-transparent">
              퀴즈쇼가 종료되었습니다!
            </h2>
            <p className="text-slate-400 text-sm mt-2">오늘 최고의 퀴즈 챔피언을 축하합니다!</p>
          </div>

          {/* Podium */}
          <div className="my-10 flex items-end justify-center gap-4 w-full max-w-lg">
            {/* 2nd Place */}
            {participants[1] && (
              <div className="flex-1 flex flex-col items-center">
                <span className="font-bold text-sm text-slate-300 mb-2">{participants[1].nickname}</span>
                <span className="text-xs text-slate-400 mb-2 font-mono">{participants[1].score}점</span>
                <div className="w-full h-36 bg-slate-700 rounded-t-2xl flex items-center justify-center font-black text-3xl text-slate-300 shadow-lg">
                  🥈 2위
                </div>
              </div>
            )}

            {/* 1st Place */}
            {participants[0] && (
              <div className="flex-1 flex flex-col items-center">
                <span className="font-black text-base text-amber-300 mb-2">👑 {participants[0].nickname}</span>
                <span className="text-xs text-amber-400 mb-2 font-mono font-bold">{participants[0].score}점</span>
                <div className="w-full h-48 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-2xl flex items-center justify-center font-black text-4xl text-slate-950 shadow-2xl shadow-amber-500/40">
                  🥇 1위
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {participants[2] && (
              <div className="flex-1 flex flex-col items-center">
                <span className="font-bold text-sm text-slate-300 mb-2">{participants[2].nickname}</span>
                <span className="text-xs text-slate-400 mb-2 font-mono">{participants[2].score}점</span>
                <div className="w-full h-28 bg-amber-900 rounded-t-2xl flex items-center justify-center font-black text-2xl text-amber-200 shadow-md">
                  🥉 3위
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleRestartLobby}
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition"
            >
              처음부터 다시 하기
            </button>
            <Link
              href="/"
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition"
            >
              홈으로 나가기
            </Link>
          </div>
        </main>
      )}
    </div>
  );
}

export default function QuizTeacherPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <QuizTeacherContent />
    </Suspense>
  );
}
