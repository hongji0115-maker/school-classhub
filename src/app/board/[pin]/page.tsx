import BoardView from '@/components/BoardView';

export function generateStaticParams() {
  return [
    { pin: '111111' },
    { pin: '222222' },
    { pin: 'demo' },
  ];
}

export default function BoardPinPage() {
  return <BoardView />;
}
