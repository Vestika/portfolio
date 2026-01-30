import AIChat from './AIChat';

export function AIChatView() {
  return (
    <div className="h-screen">
      <AIChat isOpen={true} />
    </div>
  );
}

export default AIChatView;
