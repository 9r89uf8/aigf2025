'use client';

const MessageTypeBreakdown = ({ breakdown, totalMessages }) => {
  const types = [
    {
      key: 'text',
      label: 'Text Messages',
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      color: 'bg-blue-500',
      lightColor: 'bg-blue-100',
      textColor: 'text-blue-700'
    },
    {
      key: 'image',
      label: 'Image Uploads',
      icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: 'bg-green-500',
      lightColor: 'bg-green-100',
      textColor: 'text-green-700'
    },
    {
      key: 'audio',
      label: 'Audio Messages',
      icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
      color: 'bg-purple-500',
      lightColor: 'bg-purple-100',
      textColor: 'text-purple-700'
    }
  ];

  const getPercentage = (count) => {
    if (totalMessages === 0) return 0;
    return Math.round((count / totalMessages) * 100);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Message Types</h2>
      
      <div className="space-y-4 sm:space-y-6">
        {types.map((type) => {
          const count = breakdown[type.key] || 0;
          const percentage = getPercentage(count);
          
          return (
            <div key={type.key} className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`p-1.5 sm:p-2 rounded-lg ${type.lightColor} ${type.textColor}`}>
                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={type.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-medium text-gray-900">{type.label}</p>
                    <p className="text-xs sm:text-sm text-gray-500">{count} messages</p>
                  </div>
                </div>
                <span className="text-lg sm:text-2xl font-bold text-gray-900">{percentage}%</span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${type.color} transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-600">{breakdown.text || 0}</p>
            <p className="text-xs text-gray-500">Text</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{breakdown.image || 0}</p>
            <p className="text-xs text-gray-500">Images</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">{breakdown.audio || 0}</p>
            <p className="text-xs text-gray-500">Audio</p>
          </div>
        </div>
      </div>

      {totalMessages === 0 && (
        <div className="mt-6 text-center text-gray-500">
          <p className="text-sm">No messages sent yet</p>
        </div>
      )}
    </div>
  );
};

export default MessageTypeBreakdown;