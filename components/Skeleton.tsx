/**
 * Skeleton Loading Component
 * Provides visual feedback during data loading
 * Improves perceived performance over spinners
 */

import React from 'react';

interface SkeletonProps {
  /** Width of the skeleton (CSS value) */
  width?: string;
  /** Height of the skeleton (CSS value) */
  height?: string;
  /** Border radius (CSS value or 'full' for circle) */
  rounded?: string | 'full';
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the pulse animation */
  animate?: boolean;
}

/**
 * Single skeleton element
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  rounded = '0.5rem',
  className = '',
  animate = true,
}) => {
  const borderRadius = rounded === 'full' ? '9999px' : rounded;

  return (
    <div
      className={`bg-slate-800/60 ${animate ? 'animate-pulse' : ''} ${className}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  );
};

/**
 * Text skeleton - simulates text lines
 */
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
}> = ({ lines = 3, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '70%' : '100%'}
          height="0.875rem"
        />
      ))}
    </div>
  );
};

/**
 * Card skeleton - simulates a data card
 */
export const SkeletonCard: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  return (
    <div className={`p-4 bg-[#121216] rounded-xl border border-slate-800 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton width="2.5rem" height="2.5rem" rounded="0.5rem" />
        <div className="flex-1">
          <Skeleton width="60%" height="0.875rem" className="mb-2" />
          <Skeleton width="40%" height="0.625rem" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
};

/**
 * Table row skeleton
 */
export const SkeletonTableRow: React.FC<{
  columns?: number;
  className?: string;
}> = ({ columns = 5, className = '' }) => {
  return (
    <tr className={`border-b border-slate-800/50 ${className}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton
            width={i === 0 ? '2rem' : i === 1 ? '70%' : '50%'}
            height={i === 0 ? '1rem' : '0.875rem'}
          />
        </td>
      ))}
    </tr>
  );
};

/**
 * Stats card skeleton
 */
export const SkeletonStats: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  return (
    <div className={`p-6 bg-[#121216] rounded-xl border border-slate-800 ${className}`}>
      <Skeleton width="40%" height="0.75rem" className="mb-3" />
      <Skeleton width="60%" height="2rem" className="mb-2" />
      <Skeleton width="30%" height="0.625rem" />
    </div>
  );
};

/**
 * Dashboard skeleton - full dashboard loading state
 */
export const SkeletonDashboard: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStats key={i} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-6 bg-[#121216] rounded-xl border border-slate-800">
          <Skeleton width="30%" height="1rem" className="mb-4" />
          <Skeleton width="100%" height="200px" rounded="0.5rem" />
        </div>
        <div className="p-6 bg-[#121216] rounded-xl border border-slate-800">
          <Skeleton width="30%" height="1rem" className="mb-4" />
          <Skeleton width="100%" height="200px" rounded="0.5rem" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-[#121216] rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <Skeleton width="20%" height="1rem" />
        </div>
        <table className="w-full">
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTableRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Computer table skeleton
 */
export const SkeletonComputerTable: React.FC<{
  rows?: number;
}> = ({ rows = 8 }) => {
  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex justify-between items-center bg-[#121216] p-4 rounded-xl border border-slate-800">
        <Skeleton width="300px" height="2.5rem" rounded="0.5rem" />
      </div>

      {/* Table */}
      <div className="bg-[#121216] rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-black/20 border-b border-slate-800">
            <tr>
              {['checkbox', 'Node', 'Status', 'Compliance', 'Actions'].map((_, i) => (
                <th key={i} className="px-6 py-4">
                  <Skeleton width={i === 0 ? '1rem' : '60%'} height="0.75rem" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonTableRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Skeleton;
