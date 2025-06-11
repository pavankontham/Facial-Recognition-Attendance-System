import { useState, useEffect } from 'react';
import { useAuth } from '../src/contexts/AuthContext';

export default function DebugAttendance() {
  const { currentUser, userProfile } = useAuth();
  const [debugData, setDebugData] = useState({});
  const [loading, setLoading] = useState(false);

  async function testAttendanceAPIs() {
    setLoading(true);
    const results = {};

    try {
      // Test current user info
      results.currentUser = {
        uid: currentUser?.uid,
        email: currentUser?.email
      };
      results.userProfile = userProfile;

      // Test attendance API for current user
      if (currentUser?.uid) {
        const today = new Date().toISOString().split('T')[0];
        
        // Test student attendance
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_FACE_API_URL}/api/attendance/${currentUser.uid}?start_date=${today}&end_date=${today}`);
          const data = await response.json();
          results.studentAttendance = data;
        } catch (error) {
          results.studentAttendance = { error: error.message };
        }

        // Test teacher attendance if user is teacher
        if (userProfile?.role === 'teacher') {
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_FACE_API_URL}/api/attendance/all?start_date=${today}&end_date=${today}&teacher_firebase_id=${currentUser.uid}`);
            const data = await response.json();
            results.teacherAttendance = data;
          } catch (error) {
            results.teacherAttendance = { error: error.message };
          }

          // Test teacher classes
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_FACE_API_URL}/api/classes/teacher/${currentUser.uid}`);
            const data = await response.json();
            results.teacherClasses = data;
          } catch (error) {
            results.teacherClasses = { error: error.message };
          }
        }

        // Test student classes if user is student
        if (userProfile?.role === 'student') {
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_FACE_API_URL}/api/classes/student/${currentUser.uid}`);
            const data = await response.json();
            results.studentClasses = data;
          } catch (error) {
            results.studentClasses = { error: error.message };
          }
        }
      }

      // Test sample data APIs
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_FACE_API_URL}/api/attendance/test_student_123`);
        const data = await response.json();
        results.sampleStudentAttendance = data;
      } catch (error) {
        results.sampleStudentAttendance = { error: error.message };
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_FACE_API_URL}/api/classes/teacher/test_teacher_123`);
        const data = await response.json();
        results.sampleTeacherClasses = data;
      } catch (error) {
        results.sampleTeacherClasses = { error: error.message };
      }

      setDebugData(results);
    } catch (error) {
      setDebugData({ error: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentUser && userProfile) {
      testAttendanceAPIs();
    }
  }, [currentUser, userProfile]);

  async function createSampleData() {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_FACE_API_URL}/api/test/create-sample-data`, {
        method: 'POST'
      });
      const data = await response.json();
      alert(`Sample data creation: ${data.success ? 'Success' : 'Failed'}\n${data.message}`);
      if (data.success) {
        testAttendanceAPIs();
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Attendance System Debug</h1>
          
          <div className="mb-6 flex space-x-4">
            <button
              onClick={testAttendanceAPIs}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test APIs'}
            </button>
            
            <button
              onClick={createSampleData}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Create Sample Data
            </button>
          </div>

          <div className="space-y-6">
            {Object.entries(debugData).map(([key, value]) => (
              <div key={key} className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </h3>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-96">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </div>
            ))}
          </div>

          {Object.keys(debugData).length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              Click "Test APIs" to see debug information
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
