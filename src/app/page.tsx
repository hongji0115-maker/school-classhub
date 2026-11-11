'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  MessageSquare,
  HelpCircle,
  ArrowRight,
  PlusCircle,
  PlayCircle,
  Users,
  ShieldCheck,
  Zap,
  Code2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    if (cleanPin.length !== 6) {
      setErrorMsg('PIN 코드 6자리를 올바르게 입력해주세요.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('pin_code', cleanPin)
        .single();

      if (error || !room) {
        setErrorMsg('존재하지 않거나 종료된 방입니다. PIN 번호를 확인해주세요.');
        setLoading(false);
        return;
      }

      if (room.room_type === 'board') {
        router.push(`/board?pin=${cleanPin}`);
      } else {
        router.push(`/quiz/student?pin=${cleanPin}`);
      }
    } catch {
      setErrorMsg('방 입장 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/60 via-white to-sky-50/60 flex flex-col">
      {/* Navbar */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-slate-900">ClassHub</span>
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
                100% 무료
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/hongji0115-maker/school-classhub"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <Code2 className="w-4 h-4" />
              <span>GitHub</span>
            </a>
            <Link
              href="/create/board"
              className="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 shadow-sm transition"
            >
              선생님 시작하기
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-6">
          <Zap className="w-3.5 h-3.5" />
          <span>패들렛과 카훗을 대체하는 학교 교실용 올인원 플랫폼</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight max-w-3xl">
          비싼 구독료 걱정 없는 <br />
          <span className="bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-500 bg-clip-text text-transparent">
            우리 반 실시간 참여 수업
          </span>
        </h1>

        <p className="mt-4 text-slate-600 text-base sm:text-lg max-w-xl">
          학생들은 로그인 없이 6자리 PIN으로 즉시 참여! <br />
          실시간 협업 메모 보드와 박진감 넘치는 퀴즈쇼를 무제한으로 사용하세요.
        </p>

        {/* PIN Input Box for Students */}
        <div className="mt-10 w-full max-w-md bg-white rounded-3xl shadow-xl shadow-indigo-100/60 border border-slate-200/90 p-6 sm:p-8">
          <div className="text-center mb-5">
            <h2 className="text-xl font-bold text-slate-800">학생 참가 코드 입력</h2>
            <p className="text-xs text-slate-500 mt-1">전자칠판에 보이는 6자리 PIN 번호를 입력하세요</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <input
                type="text"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="6자리 PIN (예: 111111)"
                className="w-full text-center tracking-[0.4em] font-mono text-2xl font-black py-3.5 px-4 rounded-2xl border-2 border-indigo-200 focus:border-indigo-600 focus:outline-none transition placeholder:text-slate-300 placeholder:tracking-normal placeholder:font-normal placeholder:text-base text-slate-800 bg-slate-50/50"
              />
            </div>

            {errorMsg && (
              <p className="text-rose-500 text-xs font-medium text-center">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={loading || pin.length !== 6}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 text-white font-bold text-base hover:opacity-95 disabled:opacity-50 shadow-md shadow-indigo-200 transition"
            >
              {loading ? (
                <span>확인 중...</span>
              ) : (
                <>
                  <span>수업 참여하기</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Quick Demo Launchers */}
        <div className="mt-12 w-full max-w-4xl">
          <div className="text-left mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              ⚡ 준비된 샘플로 바로 체험해보기
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Demo 1: Padlet Board */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition text-left flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
                      <MessageSquare className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                      패들렛 대체
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                    PIN: 111111
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-800">우리 반 생각 & 칭찬 나눔터</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  로그인 없이 실시간으로 포스트잇을 붙이고, 친구 의견에 하트를 누르며 생각을 나누는 협업 보드입니다.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <Link
                  href="/board?pin=111111"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition shadow-sm"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>실시간 보드 열기</span>
                </Link>
              </div>
            </div>

            {/* Demo 2: Kahoot Quiz */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition text-left flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-violet-100 text-violet-700">
                      <HelpCircle className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200">
                      카훗 대체
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                    PIN: 222222
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-800">도전! 상식 골든벨 퀴즈쇼</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  선생님 전자칠판 화면과 학생 스마트폰 컨트롤러가 실시간 연동되는 인터랙티브 퀴즈 배틀입니다.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                <Link
                  href="/quiz/teacher?pin=222222"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition shadow-sm"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>선생님 전자칠판</span>
                </Link>
                <Link
                  href="/quiz/student?pin=222222"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                >
                  <span>학생 모바일 화면</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Teacher Action Cards */}
        <div className="mt-14 w-full max-w-4xl bg-slate-900 rounded-3xl p-8 sm:p-10 text-white text-left relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/20 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
              Teacher Mode
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold mt-1">
              직접 새로운 보드나 퀴즈를 만들어보세요
            </h3>
            <p className="text-slate-300 text-sm mt-2 max-w-xl">
              원하는 주제로 1분 만에 교실 방을 생성하고 전자칠판에 띄우세요. 학생들은 별도 계정 생성 없이 링크나 PIN으로 입장합니다.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/create/board"
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-5 py-3 rounded-xl transition shadow-lg shadow-amber-500/30"
              >
                <PlusCircle className="w-4 h-4" />
                <span>새 패들렛 협업 보드 만들기</span>
              </Link>
              <Link
                href="/create/quiz"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition shadow-lg shadow-indigo-600/30"
              >
                <PlusCircle className="w-4 h-4" />
                <span>새 실시간 퀴즈쇼 만들기</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl text-left">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900">학생 개인정보 안전 보장</h4>
            <p className="text-xs text-slate-500 mt-1">
              이메일, 비밀번호 등 회원가입이 불필요하여 학생 개인정보 유출 걱정이 없습니다.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900">초저지연 Realtime</h4>
            <p className="text-xs text-slate-500 mt-1">
              Supabase 웹소켓 기술로 수십 명이 동시에 제출해도 0.1초 만에 화면에 동기화됩니다.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900">인원 & 보드 개수 무제한</h4>
            <p className="text-xs text-slate-500 mt-1">
              패들렛의 3개 제한, 카훗의 20~40명 인원 제한 없이 전교생 수업에서도 무료로 사용 가능합니다.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        ClassHub © 2026. Made for teachers and students with Supabase Realtime & Next.js.
      </footer>
    </div>
  );
}
