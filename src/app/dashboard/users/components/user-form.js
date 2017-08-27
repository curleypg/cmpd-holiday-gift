// @flow
import * as React from 'react';
import { Form } from 'neoform';
import Input from 'app/components/input';
import Box from '../../components/box';
import SelectList from './select-list';
import { Row, Col, Button } from 'react-bootstrap';
import { FormValidation } from 'neoform-validation';
import { getAffiliationList } from 'api/affiliation';
import requiredValidator from 'lib/validators/required.validator';

import type { AffiliationType } from 'api/affiliation';

async function fetchAffiliations(): Promise<AffiliationType[]> {
  const { items } = await getAffiliationList(0, null);
  return items;
}

class UserForm extends React.Component<{
  onSubmit: *,
  validate: *,
  onInvalid: *
}> {

  onReset = () => {
    console.log('reset');
  }

  render(): React.Node {

    const { onSubmit, validate, onInvalid } = this.props;

    return (

      <form id='create-new-user'
        onSubmit={e => {
          e.preventDefault();
          validate(onSubmit, onInvalid);
        }}
      >
        <Row>
          <Col xs={12}>
            <Box bsStyle="primary">
              <Row>
                <Col md={12}>
                  <p>
                    <strong>Note:</strong> After creating a new user they will need to be activated from the
                    <a href="/dashboard/user/pending"> pending registrations </a>
                    screen.
                  </p>
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <Input
                    label="First Name"
                    name="user.firstName"
                    id="firstName"
                    type="text"
                    validator={requiredValidator}
                  />
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <Input
                    label="Last Name"
                    name="user.lastName"
                    id="lastName"
                    type="text"
                    validator={requiredValidator}
                  />
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <SelectList fetchAll={fetchAffiliations}/>
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <Input
                    label="Rank / Position"
                    name="user.rank"
                    id="rank"
                    type="text"
                    validator={requiredValidator}
                  />
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <Input
                    label="Access Level"
                    name="user.accessLevel"
                    componentClass="select"
                    validator={requiredValidator}
                  >
                    <option value="admin">admin</option>
                    <option value="nominator">nominator</option>
                    <option value="nominee">nominee</option>
                    <option value="partner">partner</option>
                    <option value="volunteer">volunteer</option>

                  </Input>
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <Input
                    label="Nomiation Limit(Yearly)"
                    name="user.nominationLimit"
                    id="nominationLimit"
                    type="text"
                    validator={requiredValidator}
                  />
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <Input
                    label="Phone Number"
                    name="user.phoneNumber"
                    id="phoneNumber"
                    type="text"
                    validator={requiredValidator}
                  />
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <Input
                    label="Email"
                    name="user.email"
                    id="email"
                    type="text"
                    validator={requiredValidator}
                  />
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <Input
                    label="Confirmed Email Address"
                    name="user.emailConformation"
                    componentClass="select"
                    validator={requiredValidator}
                  >
                    <option value="unconfirmedEmail">No</option>
                    <option value="confirmedEmail">Yes-Confirmed</option>
                  </Input>
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <Input
                    label="Account Enabled"
                    name="user.enabled"
                    componentClass="select"
                    validator={requiredValidator}
                  >
                    <option value="deactivated">No-Deactivated</option>
                    <option value="active">Yes-Active</option>
                  </Input>
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <Input
                    label="Password"
                    name="user.password"
                    id="password"
                    type="text"
                    validator={requiredValidator}
                  />
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <Input
                    label="Password Confirmation"
                    name="user.passwordConfirmation"
                    id="passwordConfirmation"
                    type="text"
                    validator={requiredValidator}
                  />
                </Col>
              </Row>
              <Row>
                <Col xs={12}>
                  <Button bsStyle="info">Save</Button>
                  <span></span>
                  <Button
                    bsStyle="warning"
                    onClick={this.onReset}
                  >Reset
                  </Button>
                </Col>
              </Row>
            </Box>
          </Col>
        </Row>
      </form>
    );
  }
}

export default Form(FormValidation(UserForm));
