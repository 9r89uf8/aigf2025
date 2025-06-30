'use client';

const UsageOverview = ({ stats, isPremium }) => {
  const formatResetTime = (resetTime) => {
    if (!resetTime) return null;
    
    const now = new Date();
    const reset = new Date(resetTime);
    const diffMs = reset - now;
    
    if (diffMs <= 0) return 'Resetting...';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Usage Overview</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Total Messages */}
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Total Messages</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalMessages || 0}</p>
          <p className="text-xs text-gray-500">All-time messages sent</p>
        </div>

        {/* Message Type Breakdown */}
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Message Types</p>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xl sm:text-2xl">💬</span>
              <span className="text-base sm:text-lg font-semibold">{stats.messageTypeBreakdown?.text || 0}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xl sm:text-2xl">🖼️</span>
              <span className="text-base sm:text-lg font-semibold">{stats.messageTypeBreakdown?.image || 0}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xl sm:text-2xl">🎵</span>
              <span className="text-base sm:text-lg font-semibold">{stats.messageTypeBreakdown?.audio || 0}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">Text, Image, and Audio messages</p>
        </div>
      </div>

      {/* Usage Limits Notice */}
      {!isPremium && (
        <div className="mt-6 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
          <p className="text-sm">
            <span className="font-medium">📋 Usage Limits:</span> As a free user, you have 30 text messages per character per day. 
            Image and audio messages have separate limits. Check individual character usage below for details.
          </p>
        </div>
      )}

      {/* Premium Status */}
      {isPremium && (
        <div className="mt-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          <p className="text-sm">
            <span className="font-medium">✨ Premium Account:</span> You have unlimited messages with all characters!
          </p>
        </div>
      )}
    </div>
  );
};

export default UsageOverview;