import { useState, useEffect } from 'react';
import Layout from '../../src/components/Layout';
import { useAuth } from '../../src/contexts/AuthContext';
import { dbHelpers } from '../../src/lib/supabase';
import { Calendar, Download, Filter, CheckCircle, XCircle, BarChart3, TrendingUp } from 'lucide-react';

export default function AttendanceReports() {
  const { userProfile } = useAuth();
  const [reportData, setReportData] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    studentId: '',
    classId: '',
    slotNumber: ''
  });
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [stats, setStats] = useState({
    totalRecords: 0,
    presentCount: 0,
    absentCount: 0,
    attendanceRate: 0
  });

  useEffect(() => {
    if (userProfile) {
      fetchInitialData();
    }
  }, [userProfile]);

  useEffect(() => {
    if (filters.startDate || filters.endDate || filters.studentId) {
      fetchReportData();
    }
  }, [filters]);

  async function fetchInitialData() {
    try {
      // Get teacher's classes
      const { data: teacherClassesData } = await dbHelpers.getClassesByTeacher(userProfile.firebase_id);
      setTeacherClasses(teacherClassesData || []);

      // Get students from teacher's classes only
      let allStudents = [];
      if (teacherClassesData) {
        for (const classItem of teacherClassesData) {
          const { data: classStudents } = await dbHelpers.getClassStudents(classItem.id);
          if (classStudents) {
            // Add class info to each student and avoid duplicates
            const studentsWithClass = classStudents.map(student => ({
              ...student,
              class_name: classItem.name,
              class_id: classItem.id
            }));

            // Filter out duplicates based on student ID
            studentsWithClass.forEach(student => {
              if (!allStudents.find(s => s.id === student.id)) {
                allStudents.push(student);
              }
            });
          }
        }
      }

      setStudents(allStudents);

      // Set default date range (last 30 days)
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      setFilters(prev => ({
        ...prev,
        startDate,
        endDate
      }));
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchReportData() {
    try {
      setLoading(true);

      // Get attendance data for teacher's classes only
      let { data: attendanceData } = await dbHelpers.getAllAttendance(
        filters.startDate,
        filters.endDate,
        userProfile.firebase_id // Filter by teacher
      );

      // Apply additional filters
      if (filters.studentId) {
        attendanceData = attendanceData?.filter(record => record.student_id === filters.studentId);
      }
      if (filters.classId) {
        attendanceData = attendanceData?.filter(record => record.class_id === parseInt(filters.classId));
      }
      if (filters.slotNumber) {
        attendanceData = attendanceData?.filter(record => record.slot_number === parseInt(filters.slotNumber));
      }

      setReportData(attendanceData || []);

      // Calculate stats
      const totalRecords = attendanceData?.length || 0;
      const presentCount = attendanceData?.filter(record => record.status === 'present').length || 0;
      const absentCount = attendanceData?.filter(record => record.status === 'absent').length || 0;
      const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

      setStats({
        totalRecords,
        presentCount,
        absentCount,
        attendanceRate
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(field, value) {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  }

  function clearFilters() {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setFilters({
      startDate,
      endDate,
      studentId: '',
      classId: '',
      slotNumber: ''
    });
  }

  function setDateRange(days) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setFilters(prev => ({
      ...prev,
      startDate,
      endDate
    }));
  }

  function setWeeklyRange() {
    setDateRange(7);
  }

  function setMonthlyRange() {
    setDateRange(30);
  }

  function setSemesterRange() {
    setDateRange(120); // 4 months
  }

  function exportToCSV() {
    if (reportData.length === 0) return;
    
    const headers = ['Date', 'Student Name', 'Student ID', 'Email', 'Class', 'Slot', 'Status', 'Time'];
    const csvContent = [
      headers.join(','),
      ...reportData.map(record => [
        record.attendance_date,
        `"${record.student_name || 'Unknown'}"`,
        record.student_roll_id || 'N/A',
        record.student_email || 'N/A',
        `"${record.class_name || 'Unknown Class'}"`,
        record.slot_number || 'N/A',
        record.status,
        record.created_at ? new Date(record.created_at).toLocaleTimeString() : 'N/A'
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${filters.startDate}-to-${filters.endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  if (loading && !reportData.length) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="loading-spinner"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2">Attendance Reports</h1>
                <p className="text-emerald-100 text-lg">Generate and export detailed attendance analytics</p>
                <div className="flex items-center space-x-4 mt-3">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-emerald-300" />
                    <span className="text-sm">Advanced Analytics</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-blue-300" />
                    <span className="text-sm">{reportData.length} Records</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={exportToCSV}
              disabled={reportData.length === 0}
              className="bg-white/10 backdrop-blur-sm border border-white/30 text-white hover:bg-white/20 font-semibold py-3 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center"
            >
              <Download className="h-5 w-5 mr-2" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex items-center mb-4">
            <Filter className="h-5 w-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>

          {/* Quick Date Range Buttons */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Date Ranges
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={setWeeklyRange}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                Last 7 Days
              </button>
              <button
                onClick={setMonthlyRange}
                className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                Last 30 Days
              </button>
              <button
                onClick={setSemesterRange}
                className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
              >
                Last Semester (120 Days)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class
              </label>
              <select
                value={filters.classId}
                onChange={(e) => handleFilterChange('classId', e.target.value)}
                className="input-field"
              >
                <option value="">All Classes</option>
                {teacherClasses.map(classItem => (
                  <option key={classItem.id} value={classItem.id}>
                    {classItem.name} ({classItem.subject})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student
              </label>
              <select
                value={filters.studentId}
                onChange={(e) => handleFilterChange('studentId', e.target.value)}
                className="input-field"
              >
                <option value="">All Students</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.student_id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slot
              </label>
              <select
                value={filters.slotNumber}
                onChange={(e) => handleFilterChange('slotNumber', e.target.value)}
                className="input-field"
              >
                <option value="">All Slots</option>
                {[1,2,3,4,5,6,7,8,9].map(slot => (
                  <option key={slot} value={slot}>
                    Slot {slot}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="btn-secondary w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-2">{stats.totalRecords}</div>
            <div className="text-gray-600 font-medium">Total Records</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-green-600 mb-2">{stats.presentCount}</div>
            <div className="text-gray-600 font-medium">Present</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="text-3xl font-bold text-red-600 mb-2">{stats.absentCount}</div>
            <div className="text-gray-600 font-medium">Absent</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center transform hover:scale-105 transition-transform">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-purple-600 mb-2">{stats.attendanceRate}%</div>
            <div className="text-gray-600 font-medium">Attendance Rate</div>
          </div>
        </div>

        {/* Report Data */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Attendance Records
            {loading && <span className="ml-2 text-sm text-gray-500">(Loading...)</span>}
          </h2>
          
          {reportData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class & Slot
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(record.attendance_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {record.student_name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {record.student_email || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.student_roll_id || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {record.class_name || 'Unknown Class'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Slot {record.slot_number}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {record.status === 'present' ? (
                            <>
                              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                              <span className="text-green-600 font-medium">Present</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-5 w-5 text-red-500 mr-2" />
                              <span className="text-red-600 font-medium">Absent</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.created_at ? new Date(record.created_at).toLocaleTimeString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                No attendance records found for the selected criteria.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

