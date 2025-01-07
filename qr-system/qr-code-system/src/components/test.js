<div className="quadrant quadrant-3">
          <h3 className="rank-header">Active Employees</h3>
          <div className="employees-list overflow-auto max-h-[calc(100vh-240px)]">
            {filteredEmployees.map((employee) => (
              <div key={employee.id} 
                className="bg-opacity-20 bg-gray-800 backdrop-blur-sm rounded-lg shadow-sm p-4 mb-3 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-500 bg-opacity-20 p-2 rounded-full">
                      <User className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{employee.name}</h4>
                      <p className="text-sm text-gray-300">
                        {employee.location.replace('Agua Viva ', '')} • {employee.position}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-300">Attendance</div>
                      <div className={`text-sm font-bold ${
                        Number(employee.stats.attendanceRate) >= 90 ? 'text-green-400' :
                        Number(employee.stats.attendanceRate) >= 75 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {employee.stats.attendanceRate}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-300">On Time</div>
                      <div className={`text-sm font-bold ${
                        Number(employee.stats.onTimeRate) >= 90 ? 'text-green-400' :
                        Number(employee.stats.onTimeRate) >= 75 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {employee.stats.onTimeRate}%
                      </div>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <div className="text-sm font-medium text-gray-300">Rank</div>
                      <div className="flex items-center justify-end space-x-1">
                        <span className="text-sm font-bold text-white">
                          {employee.stats.rank}
                        </span>
                        {employee.stats.rankChange && 
                         new Date().getTime() - employee.stats.rankChange.date.getTime() <= 30 * 24 * 60 * 60 * 1000 && (
                          employee.stats.rankChange.direction === 'up' ? (
                            <TrendingUp className="h-4 w-4 text-green-400" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-400" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>