import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import moment, { Moment } from 'moment';


const prisma = new PrismaClient();
const app = express();
app.use(express.json());

// Routes

app.get('/attendance', async (req: Request, res: Response) => {
  try {
    const { from, to, userId } = req.body;
    const fromDate: Moment = moment(from as string,["DD-MM-YYYY", "YYYY-MM-DD"], true);
    const toDate: Moment = moment(to as string,["DD-MM-YYYY", "YYYY-MM-DD"], true);

    if (toDate.isBefore(fromDate)) {
      return res.status(400).json({ error: 'The To Date Cannot Be Greater Than From Date'});
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: {
          gte: fromDate.toDate(),
          lte: toDate.toDate(),
        },
      },
    });

    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;

    attendances.forEach((attendance) => {
      if (attendance.status === 'Present') {
        presentDays++;
      } else if (attendance.status === 'Absent') {
        absentDays++;
      } else if (attendance.status === 'Leave') {
        leaveDays++;
      }
    });

    const result = {
      presentDays,
      absentDays,
      leaveDays,
    };

    res.json(result);
  } catch (error) {
    console.error('Error retrieving attendances:', error);
    res.status(500).json({ error: 'Error retrieving attendances' });
  }
});

app.post('/attendance', async (req: Request, res: Response) => {
  try {
    const { userId, date, walk, status } = req.body;

  
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userId,
        date: moment.utc(date, ["DD-MM-YYYY", "YYYY-MM-DD"]).toDate(),
      },
    });

    if (existingAttendance) {
   
      if (existingAttendance.status === 'Absent' || existingAttendance.status === 'Leave') {
        if (status === 'Present') {
          if (walk === 'In') {
            const inTime = moment();

            const updatedAttendance = await prisma.attendance.update({
              where: { id: existingAttendance.id },
              data: {
                inTime: inTime.toDate(),
                status,
                updatedOn: new Date(),
              },
            });

            return res.json(updatedAttendance);
          } else if (walk === 'Out') {
            const outTime = moment();

            if (existingAttendance.inTime === null) {
              return res.status(400).json({ error: 'The InTime has not been recorded yet' });
            }

            const inTime = moment(existingAttendance.inTime);
            const workingHours = outTime.diff(inTime, 'hours', true);

            const updatedAttendance = await prisma.attendance.update({
              where: { id: existingAttendance.id },
              data: {
                outTime: outTime.toDate(),
                status,
                workingHours,
                updatedOn: new Date(),
              },
            });

            return res.json(updatedAttendance);
          }
        } else {
          return res.status(400).json({ error: 'The user is already marked as absent or leave on this date' });
        }
      } else if (status === 'Absent' || status === 'Leave') {
        return res.status(400).json({ error: 'The user is already marked as present on this date' });
      }
    }

    if (status === 'Absent' || status === 'Leave') {
      const attendance = await prisma.attendance.create({
        data: {
          userId,
          date: moment.utc(date, ["DD-MM-YYYY", "YYYY-MM-DD"]).toDate(),
          inTime: null,
          outTime: null,
          status,
          workingHours: 0,
          createdOn: new Date(),
          updatedOn: new Date(),
        },
      });

      return res.json(attendance);
    }
    if (walk === 'In') {
      
      const inTime = moment();

      const existingAttendance = await prisma.attendance.findFirst({
        where: {
          userId,
          date: moment.utc(date, ["DD-MM-YYYY", "YYYY-MM-DD"]).toDate(),
        },
      });

      if (existingAttendance) {
        return res.status(400).json({ error: 'The InTime already exists' });
      }

      const workingHours = 0;

      const attendance = await prisma.attendance.create({
        data: {
          userId,
          date: moment.utc(date, ["DD-MM-YYYY", "YYYY-MM-DD"]).toDate(),
          inTime: inTime.toDate(),
          outTime: null,
          status,
          workingHours,
          createdOn: new Date(),
          updatedOn: new Date(),
        },
      });

      res.json(attendance);
    } else {
      const { Out } = walk;
    
      const outTime = moment();
    
      const existingAttendance = await prisma.attendance.findFirst({
        where: {
          userId,
          date: moment.utc(date, ["DD-MM-YYYY", "YYYY-MM-DD"]).toDate(),
        },
      });
    
      if (existingAttendance && existingAttendance.inTime !== null) {
        const inTime = moment(existingAttendance.inTime);
    
        if (existingAttendance.outTime !== null) {
          return res.status(400).json({ error: 'The OutTime has already been recorded' });
        }
    
      
        const workingHours = outTime.diff(inTime, 'hours', true);
    
        const updatedAttendance = await prisma.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            outTime: outTime.toDate(), 
            status,
            workingHours,
            updatedOn: new Date(),
          },
        });
    
        res.json(updatedAttendance);
      } else {
        return res.status(400).json({ error: 'The InTime does not exist' });
      }
    }
  } catch (error) {
    console.error('Error creating/updating attendance:', error);
    res.status(500).json({ error: 'Error creating/updating attendance' });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
