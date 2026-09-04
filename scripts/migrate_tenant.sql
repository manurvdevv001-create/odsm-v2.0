UPDATE Classroom SET schoolMatricule = (SELECT matricule FROM School LIMIT 1) WHERE schoolMatricule = 'TO_MIGRATE';
UPDATE Course SET schoolMatricule = (SELECT matricule FROM School LIMIT 1) WHERE schoolMatricule = 'TO_MIGRATE';
UPDATE Assessment SET schoolMatricule = (SELECT matricule FROM School LIMIT 1) WHERE schoolMatricule = 'TO_MIGRATE';
UPDATE StudentResult SET schoolMatricule = (SELECT matricule FROM School LIMIT 1) WHERE schoolMatricule = 'TO_MIGRATE';
UPDATE Enrollment SET schoolMatricule = (SELECT matricule FROM School LIMIT 1) WHERE schoolMatricule = 'TO_MIGRATE';
UPDATE GradeSubmission SET schoolMatricule = (SELECT matricule FROM School LIMIT 1) WHERE schoolMatricule = 'TO_MIGRATE';
UPDATE Subject SET schoolMatricule = (SELECT matricule FROM School LIMIT 1) WHERE schoolMatricule = 'TO_MIGRATE';
UPDATE PeriodClosure SET schoolMatricule = (SELECT matricule FROM School LIMIT 1) WHERE schoolMatricule = 'TO_MIGRATE';
