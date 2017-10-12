// @flow

const db = require('../../../models');
const TableApi = require('../../lib/tableApi');
const sequelize = require('sequelize');
const { validationResult } = require('express-validator/check');
const { matchedData } = require('express-validator/filter');
const logger = require('../../lib/logger');
const related = [{ model: db.child, as: 'children' }, { model: db.user, as: 'nominator' }];
const formidable = require('formidable');
const path = require('path');
const fs = require('fs-extra');

import type { Response } from '../../lib/typed-express';
import type { UserRequest, AnyRole } from '../../lib/auth';
import type { TableRequest } from '../../lib/tableApi';

type ListRequest = {
    ...TableRequest,
    search: string
}

const childDefaults = {
  additional_ideas: '',
  bike_want: false,
  bike_size: null,
  bike_style: null,
  clothes_want: false,
  clothes_size_shirt: null,
  clothes_size_pants: null,
  shoe_size: null,
  favourite_colour: null,
  interests: '',
  reason_for_nomination: ''
};

const householdDefaults = {
  draft: true,
  nomination_email_sent: false,
  reviewed: false,
  approved: false
};

module.exports = {
  list: async (req: UserRequest<>, res: Response): Promise<void> => {
    const query: ListRequest = (req.query: any);
    const api = new TableApi(req, query);
    try {
      let whereClause = {};
      if (query.search) {
        whereClause = { name_last: { $like: `${query.search}%` } };
      }
      const result = await api.fetchAndParse(db.household, whereClause, related, { method: ['filteredByUser', req.user] });
      res.json(result);
    } catch (err) {
            // TODO: properly log error
      console.error(err);
      res.json({ error: 'error fetching data' });
    }
  },
  getHousehold: async (req: UserRequest<AnyRole, { id: string }>, res: Response): Promise<void> => {
    let household = null;
    try {
      household = await db.household.findById(req.params.id, { include: related });
      if (!household) {
        throw new Error('Household not found');
      }
    } catch (err) {
      household = null;
      res.status(404);
    }
        // var schools = await db.affiliation.findAll({
        //   attributes: ['id', 'name'],
        //   where: { type: 'cms' }
        // });
    res.json(household);
  },

  async upload(req: any, res: any) {

    const uploadDir = path.join(process.cwd(), 'uploads');
    const nomDir = path.join(process.cwd(), 'uploads', req.params.id);
    // create an incoming form object
    const form = new formidable.IncomingForm();

   // specify that we want to allow the user to upload multiple files in a single request
    form.multiples = true;

   // store all uploads in the /uploads directory
    form.uploadDir = uploadDir;

   // every time a file has been uploaded successfully,
   // rename it to it's orignal name
    form.on('file', function (field, file) {
      fs.ensureDir(nomDir).then(() => fs.copy(file.path, path.join(nomDir, file.name)));
    });

   // log any errors that occur
    form.on('error', function (err) {
      console.log('An error has occured: \n' + err);
    });

   // once all the files have been uploaded, send a response to the client
    form.on('end', function () {
      res.sendStatus(200);
    });

   // parse the incoming request containing the form data
    form.parse(req);
  },

  async submitNomination(req: any, res: any): Promise<void> {
    logger.info('submitting nominations');
    const { id } = req.body;

    let household = undefined;

    try {
      logger.info('searching for nomination');
      household = await db.household.findById(id);
      if (!household) {
        throw new Error('Household not found');
      }

      logger.info(household);

      household.draft = false;
      household.save().then(() => res.sendStatus(200));
    } catch (err) {
      res.sendStatus(404);
    }
  },

  async updateHousehold(req, res): Promise<void> {
    logger.info('updateHousehold');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.mapped() });
    }

    const { id } = req.params;

    return db.sequelize.transaction(async t => {
      const payload = matchedData(req);

      try {
        logger.info('finding household', id);
        const household = await db.household.findById(id);
        const address = await db.household_address.find({ where: { household_id: id } });

        household.update(Object.assign({}, payload.household));
        address.update(Object.assign({}, payload.address));

        const numbers = await db.household_phone.findAll({ where: { household_id: id } });

        const removedNumbers = numbers && numbers.filter(entity => payload.phoneNumbers && payload.phoneNumbers.every(json => json.number !== entity.dataValues.number));
        const addedNumbers = payload.phoneNumbers && payload.phoneNumbers.filter(json => numbers && numbers.every(entity => json.number !== entity.dataValues.number)) || [];
        const updatedNumbers = payload.phoneNumbers && payload.phoneNumbers.filter(json => numbers && numbers.some(entity => json.number === entity.dataValues.number)) || [];

        for (const removed of removedNumbers) {
          logger.info('removing number');

          removed.destroy();
        }

        for (const added of addedNumbers) {
          logger.info('adding number');

          db.household_phone.create(Object.assign({}, added, { household_id: id }));
        }

        for (const updated of updatedNumbers) {
          logger.info('updating number');

          const toUpdate = numbers.find(number => updated.number === number.number);
          toUpdate.update(updated);
        }

        const nominations = await db.child.findAll({ where: { household_id: id } });

        const removedNominations = nominations && nominations.filter(entity => payload.nominations && payload.nominations.every(json => json.last4ssn !== entity.last4ssn));
        const addedNominations = payload.nominations && payload.nominations.filter(json => nominations && nominations.every(entity => json.last4ssn !== entity.dataValues.last4ssn)) || [];
        const updatedNominations = payload.nominations && payload.nominations.filter(json => nominations && nominations.some(entity => json.last4ssn === entity.dataValues.last4ssn)) || [];

        for (const removed of removedNominations) {
          logger.info('removing nomination');

          removed.destroy();
        }

        for (const added of addedNominations) {
          logger.info('adding nomination');

          db.child.create(Object.assign({}, added, childDefaults, { household_id: id }));
        }

        for (const updated of updatedNominations) {
          logger.info('updating nomination');

          const toUpdate = nominations.find(nomination => nomination.last4ssn === updated.last4ssn);
          toUpdate.update(updated);
        }


      } catch (error) {
        logger.info(error);
      }

    }).then(() => res.sendStatus(200));
  },

  createHousehold: async (req: any, res: any): Promise<void> => {
        // TODO: Check if user has reached nomination limit and reject if so

    const nominator = Object.assign({}, req.user);
    const count = await db.household.count({ where: { 'nominator_id': nominator.id } });

    let id = undefined;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.mapped() });
    }

    return db.sequelize
            .transaction(async t => {
              const { household, address, phoneNumbers, nominations } = req.body;

              logger.info('creating household');
                // Create household record
              const newHousehold = await db.household.create(Object.assign({}, householdDefaults, household, { nominator_user_id: nominator.id }));

              logger.info('creating household_address');

                // Create address record (from address{})
              db.household_address.create({
                street: address.street,
                street2: address.street2 || '',
                city: address.city,
                state: address.state,
                zip: address.zip,
                cmpd_division: address.cmpd_division,
                cmpd_response_area: address.cmpd_response_area,
                type: address.type || '',
                household_id: newHousehold.id
              });

              for (const phone of phoneNumbers) {
                logger.info('creating household_phone');
                db.household_phone.create({
                  number: phone.number,
                  type: phone.type,
                  household_id: newHousehold.id
                });
              }

                // Create child records (from nominations[])
              for (const child of nominations) {
                logger.info('creating child');

                db.child.create(Object.assign({}, childDefaults, child, { household_id: id }));

                id = newHousehold.id;
              }
            })
            .then(() => {
              res.json({ id });
                // Success. Committed.
            })
            .catch(error => {
                // Error. Rolled back.
              logger.error(error);
              res.sendStatus(500);
            });
  }

    // async function register(req: Request<>, res: Response): Promise<void> {
    //   const body: RegisterRequest = (req.body: any);
    //   const error = await registration.steps.register(rootUrl(req), {
    //     name_first: body.firstname,
    //     name_last: body.lastname,
    //     rank: body.rank,
    //     phone: body.phone,
    //     affiliation_id: body.affiliation,
    //     email: body.email,
    //     raw_password: body.password
    //   });
    //   if (error) {
    //     res.json(error);
    //   } else {
    //     res.json({ success: true });
    //   }
    // }
};
