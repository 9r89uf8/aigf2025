'use client';

import { useRouter } from 'next/navigation';

const PremiumUpsell = ({ messagesRemaining, resetTime }) => {
  const router = useRouter();

  const handleUpgrade = () => {
    router.push('/pricing');
  };

  const formatResetTime = (resetTime) => {
    if (!resetTime) return null;
    
    const now = new Date();
    const reset = new Date(resetTime);
    const diffMs = reset - now;
    
    if (diffMs <= 0) return 'soon';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    }
    return `in ${minutes}m`;
  };

  return (
    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-4 sm:p-6 text-white">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <h3 className="text-lg sm:text-xl font-bold">Running Low on Messages!</h3>
          </div>
          
          <p className="text-white/90 mb-4">
            You have only <span className="font-bold">{messagesRemaining} messages</span> remaining
            {resetTime && ` (resets ${formatResetTime(resetTime)})`}.
            Upgrade to Premium for unlimited messaging!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">Unlimited messages</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">Priority access</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">Advanced features</span>
            </div>
          </div>

          <button
            onClick={handleUpgrade}
            className="w-full sm:w-auto bg-white text-indigo-600 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-md"
          >
            Upgrade to Premium
          </button>
        </div>

        <button className="self-start sm:self-auto text-white/60 hover:text-white/80 transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Urgency indicator for very low messages */}
      {messagesRemaining <= 5 && (
        <div className="mt-4 bg-white/20 rounded-lg p-3 backdrop-blur-sm">
          <p className="text-sm font-medium flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></span>
            {messagesRemaining === 0 
              ? "You've used all your messages for today!" 
              : `Only ${messagesRemaining} message${messagesRemaining === 1 ? '' : 's'} left!`}
          </p>
        </div>
      )}
    </div>
  );
};

export default PremiumUpsell;