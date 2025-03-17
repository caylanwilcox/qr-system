import React, { useEffect, useState } from 'react';
import { useSchedulerContext } from '../Scheduler/context/SchedulerContext';

const RepairButton = () => {
  const [repairing, setRepairing] = useState(false);
  const [result, setResult] = useState(null);
  const { repairAllScheduleNodes } = useSchedulerContext();

  const handleRepair = async () => {
    setRepairing(true);
    try {
      const result = await repairAllScheduleNodes();
      setResult(result);
      console.log('Repair completed:', result);
    } catch (error) {
      console.error('Repair failed:', error);
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div>
      <button 
        onClick={handleRepair}
        disabled={repairing}
      >
        {repairing ? 'Repairing...' : 'Repair All Schedule Nodes'}
      </button>
      
      {result && (
        <div>
          <p>Repair {result.success ? 'succeeded' : 'failed'}</p>
          {result.success && (
            <p>Created {result.created} nodes out of {result.checked} users</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RepairButton;