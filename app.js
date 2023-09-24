const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemon = require("nodemon");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("DB/Server started.");
    });
  } catch (error) {
    console.log("Error in connecting db or server");
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  //   console.log("Executing middleware function");
  let jwtToken;
  const authHeader = request.headers["authorization"];
  //   console.log(authHeader);
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    // console.log("1st if condition");
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "Secret_String", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
        // console.log("nested-if condition");
      } else {
        next();
      }
    });
  }
};

//API 1 - Login
app.post("/login/", async (request, response) => {
  const user = await db.get(
    `SELECT * FROM user WHERE username = '${request.body.username}'`
  );
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      request.body.password,
      user.password
    );
    if (isPasswordMatched) {
      const jwtToken = jwt.sign(
        { username: request.body.username },
        "Secret_String"
      );
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2 - returning all states
app.get("/states/", authenticateToken, async (request, response) => {
  //   console.log("API 2 executing...");
  response.send(await db.all("SELECT * FROM state;"));
});

//API 3 - returning state using id
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  response.send(
    await db.get(`
        SELECT
            *
        FROM
            state
        WHERE
            state_id = ${stateId};
    `)
  );
});

//API 4 - create district into district table
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  await db.run(`
    INSERT INTO
        district
    (district_name, state_id, cases, cured, active, deaths)
    VALUES
    ('${districtName}', ${stateId},${cases},${cured},${active},${deaths});
  `);
  response.send("District Successfully Added");
});

//API 5 - returns district details using district id
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    response.send(
      await db.get(`
        SELECT
            *
        FROM
            district
        WHERE
            district_id = ${request.params.districtId};
    `)
    );
  }
);

//API 6 - Deletes district suing district id
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    await db.run(`
        DELETE FROM
            district
        WHERE
            district_id = ${request.params.districtId};
    `);
    response.send("District Removed");
  }
);

//API 7 - Updates the details of a specific district based on the district ID
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    await db.run(`
        UPDATE
            district
        SET
            district_name = '${request.body.districtName}',
            state_id = ${request.body.stateId},
            cases = ${request.body.cases},
            cured = ${request.body.cured},
            active = ${request.body.active},
            deaths = ${request.body.deaths}
        WHERE
            district_id = ${request.params.districtId};
    `);
    response.send("District Details Updated");
  }
);

//API 8 - Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    response.send(
      await db.get(`
        SELECT
            SUM(cases) as totalCases,
            SUM(cured) as totalCured,
            SUM(Active) as totalActive,
            SUM(deaths) as totalDeaths
        FROM
            district
        WHERE
            state_id = ${request.params.stateId};
    `)
    );
  }
);

module.exports = app;
